import { Router } from 'express';
import { pool } from '../db.js';
import { asyncRoute, HttpError, requireId, requireNonNegativeNumber, requireText } from '../http.js';
import { REORDER_MULTIPLIER } from '../../../shared/inventoryRules.js';

// The UI offers g / ml / each; older rows may use other units, so any short label is accepted.
const MAX_UNIT_LENGTH = 50;

const INVENTORY_COLUMNS = `inventory_id AS id, ingredient_name AS name, unit,
          quantity_on_hand AS "onHand", reorder_level AS "reorderLevel",
          to_char(updated_at, 'YYYY-MM-DD HH24:MI:SS') AS "updatedAt"`;

export function parseIngredient(body = {}) {
  const unit = requireText(body.unit, 'Unit');
  if (unit.length > MAX_UNIT_LENGTH) {
    throw new HttpError(400, `Unit must be at most ${MAX_UNIT_LENGTH} characters.`);
  }
  return {
    name: requireText(body.name, 'Ingredient'),
    unit,
    onHand: requireNonNegativeNumber(body.onHand, 'On hand'),
    reorderLevel: requireNonNegativeNumber(body.reorderLevel, 'Reorder level'),
  };
}

/** Restocks every low-stock ingredient with a positive reorder level to REORDER_MULTIPLIER x reorder_level. */
export async function reorderLowInventory(db) {
  const { rows } = await db.query(
    `UPDATE inventory
     SET quantity_on_hand = ROUND(reorder_level * $1::numeric, 2),
         updated_at = NOW()
     WHERE quantity_on_hand <= reorder_level
       AND reorder_level > 0
     RETURNING ${INVENTORY_COLUMNS}`,
    [REORDER_MULTIPLIER],
  );
  return { count: rows.length, items: rows };
}

/** Restocks one low-stock ingredient to REORDER_MULTIPLIER x reorder_level. */
export async function reorderIngredient(db, id) {
  const { rows } = await db.query(
    `UPDATE inventory
     SET quantity_on_hand = ROUND(reorder_level * $2::numeric, 2),
         updated_at = NOW()
     WHERE inventory_id = $1
       AND reorder_level > 0
       AND quantity_on_hand <= reorder_level
     RETURNING ${INVENTORY_COLUMNS}`,
    [id, REORDER_MULTIPLIER],
  );
  if (rows.length > 0) return rows[0];

  const { rows: [item] } = await db.query(
    `SELECT ingredient_name AS name, quantity_on_hand AS "onHand", reorder_level AS "reorderLevel"
     FROM inventory WHERE inventory_id = $1`,
    [id],
  );
  if (!item) throw new HttpError(404, `Ingredient #${id} was not found.`);
  if (Number(item.reorderLevel) <= 0) {
    throw new HttpError(400, `Set a reorder level above 0 before reordering ${item.name}.`);
  }
  throw new HttpError(409, `${item.name} is already above its reorder level.`);
}

export function createInventoryRoutes({ db = pool } = {}) {
  const router = Router();

  // GET /api/inventory
  router.get('/', asyncRoute(async (_req, res) => {
    const { rows } = await db.query(
      `SELECT ${INVENTORY_COLUMNS}
       FROM inventory ORDER BY inventory_id`,
    );
    res.json(rows);
  }));

  // POST /api/inventory { name, unit, onHand, reorderLevel }
  router.post('/', asyncRoute(async (req, res) => {
    const item = parseIngredient(req.body);
    const { rows } = await db.query(
      `INSERT INTO inventory (ingredient_name, unit, quantity_on_hand, reorder_level)
       VALUES ($1, $2, $3, $4) RETURNING inventory_id AS id`,
      [item.name, item.unit, item.onHand, item.reorderLevel],
    );
    res.status(201).json(rows[0]);
  }));

  // POST /api/inventory/reorder-low (registered before /:id/reorder)
  router.post('/reorder-low', asyncRoute(async (_req, res) => {
    const result = await reorderLowInventory(db);
    res.json(result);
  }));

  // POST /api/inventory/:id/reorder
  router.post('/:id/reorder', asyncRoute(async (req, res) => {
    const id = requireId(req.params.id);
    const updated = await reorderIngredient(db, id);
    res.json(updated);
  }));

  // PUT /api/inventory/:id { name, unit, onHand, reorderLevel }
  router.put('/:id', asyncRoute(async (req, res) => {
    const id = requireId(req.params.id);
    const item = parseIngredient(req.body);
    const { rowCount } = await db.query(
      `UPDATE inventory SET ingredient_name = $1, unit = $2, quantity_on_hand = $3,
              reorder_level = $4, updated_at = NOW()
       WHERE inventory_id = $5`,
      [item.name, item.unit, item.onHand, item.reorderLevel, id],
    );
    if (rowCount === 0) throw new HttpError(404, `Ingredient #${id} was not found.`);
    res.json({ id });
  }));

  return router;
}

export default createInventoryRoutes();
