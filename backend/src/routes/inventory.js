import { Router } from 'express';
import { pool, withTransaction } from '../db.js';
import { asyncRoute, HttpError, requireId, requireNonNegativeNumber, requireText } from '../http.js';

const router = Router();

// The UI offers g / ml / each; older rows may use other units, so any short label is accepted.
const MAX_UNIT_LENGTH = 50;

/** Days of sales averaged to estimate each ingredient's daily use. */
export const USAGE_WINDOW_DAYS = 28;

const optionalAmount = (value, label) => (value === undefined || value === null ? null : requireNonNegativeNumber(value, label));

function parseIngredient(body = {}, { onHandRequired }) {
  const unit = requireText(body.unit, 'Unit');
  if (unit.length > MAX_UNIT_LENGTH) {
    throw new HttpError(400, `Unit must be at most ${MAX_UNIT_LENGTH} characters.`);
  }
  return {
    name: requireText(body.name, 'Ingredient'),
    unit,
    onHand: onHandRequired ? requireNonNegativeNumber(body.onHand, 'On hand') : optionalAmount(body.onHand, 'On hand'),
    reorderLevel: requireNonNegativeNumber(body.reorderLevel, 'Reorder level'),
  };
}

const INGREDIENT_COLUMNS = `
  inventory_id AS id, ingredient_name AS name, unit,
  quantity_on_hand AS "onHand", reorder_level AS "reorderLevel",
  to_char(updated_at, 'YYYY-MM-DD HH24:MI:SS') AS "updatedAt"`;

// GET /api/inventory
// Each ingredient also carries dailyUse (average per day over the last USAGE_WINDOW_DAYS days,
// from sold items' recipes, the same way orders deduct stock) and usedIn (menu items using it).
router.get('/', asyncRoute(async (_req, res) => {
  const { rows } = await pool.query(
    `WITH used AS (
       SELECT r.inventory_id, SUM(oi.quantity * r.quantity_required) AS amount
       FROM order_items oi
       JOIN orders o ON o.order_id = oi.order_id
       JOIN recipes r ON r.menu_item_id = oi.menu_item_id
       WHERE o.created_at >= CURRENT_DATE - ($1::int - 1)
       GROUP BY r.inventory_id
     ), recipe_counts AS (
       SELECT inventory_id, COUNT(*) AS n FROM recipes GROUP BY inventory_id
     )
     SELECT ${INGREDIENT_COLUMNS},
            ROUND(COALESCE(used.amount, 0) / $1::int, 3) AS "dailyUse",
            COALESCE(recipe_counts.n, 0) AS "usedIn"
     FROM inventory
     LEFT JOIN used USING (inventory_id)
     LEFT JOIN recipe_counts USING (inventory_id)
     ORDER BY ingredient_name, inventory_id`,
    [USAGE_WINDOW_DAYS],
  );
  res.json(rows);
}));

// GET /api/inventory/:id/recipes -> menu items that use this ingredient, with the amount per serving
router.get('/:id/recipes', asyncRoute(async (req, res) => {
  const id = requireId(req.params.id);
  const { rows: [exists] } = await pool.query('SELECT 1 FROM inventory WHERE inventory_id = $1', [id]);
  if (!exists) throw new HttpError(404, `Ingredient #${id} was not found.`);
  const { rows } = await pool.query(
    `SELECT m.menu_item_id AS id, m.name, m.category, m.is_available AS "isAvailable",
            r.quantity_required AS quantity
     FROM recipes r JOIN menu_items m ON m.menu_item_id = r.menu_item_id
     WHERE r.inventory_id = $1
     ORDER BY m.name`,
    [id],
  );
  res.json(rows);
}));

// POST /api/inventory { name, unit, onHand, reorderLevel }
router.post('/', asyncRoute(async (req, res) => {
  const item = parseIngredient(req.body, { onHandRequired: true });
  const { rows } = await pool.query(
    `INSERT INTO inventory (ingredient_name, unit, quantity_on_hand, reorder_level)
     VALUES ($1, $2, $3, $4) RETURNING inventory_id AS id`,
    [item.name, item.unit, item.onHand, item.reorderLevel],
  );
  res.status(201).json(rows[0]);
}));

const MAX_RESTOCK_LINES = 200;

function parseRestock(body = {}) {
  const { items } = body;
  if (!Array.isArray(items) || items.length === 0) {
    throw new HttpError(400, 'List at least one ingredient to restock.');
  }
  if (items.length > MAX_RESTOCK_LINES) {
    throw new HttpError(400, `Restock at most ${MAX_RESTOCK_LINES} ingredients at a time.`);
  }
  const seen = new Set();
  return items.map((line) => {
    const id = requireId(line?.id, 'Ingredient');
    if (seen.has(id)) throw new HttpError(400, `Ingredient #${id} is listed more than once.`);
    seen.add(id);
    const amount = typeof line?.amount === 'string' ? Number(line.amount.trim()) : line?.amount;
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
      throw new HttpError(400, 'Restock amount must be a number greater than 0.');
    }
    return { id, amount };
  });
}

// NUMERIC(10, 2) tops out just under 100,000,000.
const rethrowOverflow = (err) => {
  if (err.code === '22003') throw new HttpError(400, 'That amount is larger than can be stored.');
  throw err;
};

// POST /api/inventory/restock { items: [{ id, amount }] }
// Adds each amount to what is on hand (rather than overwriting it, so sales made meanwhile
// aren't lost). All lines succeed or none do. Responds with the updated ingredients.
router.post('/restock', asyncRoute(async (req, res) => {
  const lines = parseRestock(req.body);
  const updated = await withTransaction(async (client) => {
    const rows = [];
    for (const line of lines) {
      const { rows: [row] } = await client.query(
        `UPDATE inventory SET quantity_on_hand = quantity_on_hand + $1, updated_at = NOW()
         WHERE inventory_id = $2
         RETURNING ${INGREDIENT_COLUMNS}`,
        [line.amount, line.id],
      );
      if (!row) throw new HttpError(404, `Ingredient #${line.id} was not found.`);
      rows.push(row);
    }
    return rows;
  }).catch(rethrowOverflow);
  res.json(updated);
}));

// PUT /api/inventory/:id { name, unit, reorderLevel, onHand?, expectedOnHand? }
// Leave onHand out to keep the current stock. When setting onHand (e.g. after a stock count),
// send expectedOnHand = the amount the form was showing: if sales changed it since, the save is
// refused with 409 instead of silently erasing those deductions.
router.put('/:id', asyncRoute(async (req, res) => {
  const id = requireId(req.params.id);
  const item = parseIngredient(req.body, { onHandRequired: false });
  const expectedOnHand = optionalAmount(req.body?.expectedOnHand, 'Expected on hand');
  const { rows: [row] } = await pool.query(
    `UPDATE inventory SET ingredient_name = $1, unit = $2,
            quantity_on_hand = COALESCE($3, quantity_on_hand),
            reorder_level = $4, updated_at = NOW()
     WHERE inventory_id = $5 AND ($6::numeric IS NULL OR quantity_on_hand = $6::numeric)
     RETURNING ${INGREDIENT_COLUMNS}`,
    [item.name, item.unit, item.onHand, item.reorderLevel, id, expectedOnHand],
  ).catch(rethrowOverflow);
  if (row) {
    res.json(row);
    return;
  }
  const { rows: [current] } = await pool.query(
    'SELECT quantity_on_hand AS "onHand", unit FROM inventory WHERE inventory_id = $1',
    [id],
  );
  if (!current) throw new HttpError(404, `Ingredient #${id} was not found.`);
  throw new HttpError(
    409,
    `On hand changed from ${expectedOnHand} to ${current.onHand} ${current.unit} since you opened this ingredient `
      + '(probably from new orders). Check the amount and save again.',
  );
}));

// DELETE /api/inventory/:id
// Refused while a recipe uses the ingredient: deleting it would silently drop it from those recipes.
router.delete('/:id', asyncRoute(async (req, res) => {
  const id = requireId(req.params.id);
  const { rowCount } = await pool.query(
    `DELETE FROM inventory WHERE inventory_id = $1
       AND NOT EXISTS (SELECT 1 FROM recipes WHERE inventory_id = $1)`,
    [id],
  );
  if (rowCount > 0) {
    res.status(204).end();
    return;
  }
  const { rows: [exists] } = await pool.query('SELECT 1 FROM inventory WHERE inventory_id = $1', [id]);
  if (!exists) throw new HttpError(404, `Ingredient #${id} was not found.`);
  const { rows: items } = await pool.query(
    `SELECT m.name FROM recipes r JOIN menu_items m ON m.menu_item_id = r.menu_item_id
     WHERE r.inventory_id = $1 ORDER BY m.name`,
    [id],
  );
  const names = items.map((m) => m.name);
  const list = names.length > 3 ? `${names.slice(0, 3).join(', ')} and ${names.length - 3} more` : names.join(', ');
  throw new HttpError(409, `This ingredient is used in ${names.length} menu item recipe(s): ${list}. Remove it from those recipes first.`);
}));

export default router;
