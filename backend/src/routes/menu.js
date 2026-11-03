import { Router } from 'express';
import { pool, withTransaction } from '../db.js';
import { asyncRoute, HttpError, requireCents, requireId, requireText } from '../http.js';
import { ITEM_TYPES } from '../../../shared/orderRules.js';

const router = Router();

const SEASONAL_CATEGORY = 'Seasonal';

const SELECT_MENU = `
  SELECT menu_item_id AS id, name, category, item_type AS "itemType", description,
         price_cents AS "priceCents", is_available AS "isAvailable"
  FROM menu_items`;

function parseMenuItem(body = {}) {
  const itemType = requireText(body.itemType, 'Type').toLowerCase();
  if (!ITEM_TYPES.includes(itemType)) {
    throw new HttpError(400, `Type must be one of: ${ITEM_TYPES.join(', ')}.`);
  }
  return {
    name: requireText(body.name, 'Name'),
    category: requireText(body.category, 'Category'),
    itemType,
    priceCents: requireCents(body.priceCents),
    isAvailable: body.isAvailable !== false,
  };
}

// menu_item_id is not SERIAL, so new IDs are MAX + 1. The table lock stops two
// simultaneous inserts from picking the same ID.
async function insertMenuItem(client, item) {
  await client.query('LOCK TABLE menu_items IN SHARE ROW EXCLUSIVE MODE');
  const { rows } = await client.query(
    `INSERT INTO menu_items (menu_item_id, name, category, item_type, price_cents, is_available)
     VALUES ((SELECT COALESCE(MAX(menu_item_id), 0) + 1 FROM menu_items), $1, $2, $3, $4, $5)
     RETURNING menu_item_id AS id`,
    [item.name, item.category, item.itemType, item.priceCents, item.isAvailable],
  );
  return rows[0].id;
}

// GET /api/menu            -> every item (manager view)
// GET /api/menu?available=true -> only items cashiers can sell
router.get('/', asyncRoute(async (req, res) => {
  const onlyAvailable = req.query.available === 'true';
  const sql = onlyAvailable
    ? `${SELECT_MENU} WHERE is_available ORDER BY name`
    : `${SELECT_MENU} ORDER BY menu_item_id`;
  const { rows } = await pool.query(sql);
  res.json(rows);
}));

// POST /api/menu { name, category, itemType, priceCents, isAvailable }
router.post('/', asyncRoute(async (req, res) => {
  const item = parseMenuItem(req.body);
  const id = await withTransaction((client) => insertMenuItem(client, item));
  res.status(201).json({ id });
}));

// PUT /api/menu/:id { name, category, itemType, priceCents, isAvailable }
router.put('/:id', asyncRoute(async (req, res) => {
  const id = requireId(req.params.id);
  const item = parseMenuItem(req.body);
  const { rowCount } = await pool.query(
    `UPDATE menu_items SET name = $1, category = $2, item_type = $3, price_cents = $4, is_available = $5
     WHERE menu_item_id = $6`,
    [item.name, item.category, item.itemType, item.priceCents, item.isAvailable, id],
  );
  if (rowCount === 0) throw new HttpError(404, `Menu item #${id} was not found.`);
  res.json({ id });
}));

// POST /api/menu/seasonal { name, itemType, priceCents, isAvailable, recipe: [{ inventoryId, quantity }] }
// The item and its recipe are saved together so inventory usage is tracked from the first sale.
router.post('/seasonal', asyncRoute(async (req, res) => {
  const item = parseMenuItem({ ...req.body, category: SEASONAL_CATEGORY });
  const recipe = Array.isArray(req.body?.recipe) ? req.body.recipe : [];
  if (recipe.length === 0) {
    throw new HttpError(400, 'Add at least one ingredient.');
  }
  const seen = new Set();
  const lines = recipe.map((line) => {
    const inventoryId = requireId(line?.inventoryId, 'Ingredient');
    const quantity = Number(line?.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new HttpError(400, 'Each ingredient quantity must be a positive number.');
    }
    if (seen.has(inventoryId)) {
      throw new HttpError(400, 'Each ingredient can only be listed once.');
    }
    seen.add(inventoryId);
    return { inventoryId, quantity };
  });

  const id = await withTransaction(async (client) => {
    const menuItemId = await insertMenuItem(client, item);
    for (const line of lines) {
      await client.query(
        'INSERT INTO recipes (menu_item_id, inventory_id, quantity_required) VALUES ($1, $2, $3)',
        [menuItemId, line.inventoryId, line.quantity],
      );
    }
    return menuItemId;
  });
  res.status(201).json({ id });
}));

export default router;
