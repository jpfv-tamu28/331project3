import { Router } from 'express';
import { pool } from '../db.js';
import { asyncRoute, HttpError, requireId, requireNonNegativeNumber, requireText } from '../http.js';

const router = Router();

// The UI offers g / ml / each; older rows may use other units, so any short label is accepted.
const MAX_UNIT_LENGTH = 50;

function parseIngredient(body = {}) {
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

// GET /api/inventory
router.get('/', asyncRoute(async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT inventory_id AS id, ingredient_name AS name, unit,
            quantity_on_hand AS "onHand", reorder_level AS "reorderLevel",
            to_char(updated_at, 'YYYY-MM-DD HH24:MI:SS') AS "updatedAt"
     FROM inventory ORDER BY inventory_id`,
  );
  res.json(rows);
}));

// POST /api/inventory { name, unit, onHand, reorderLevel }
router.post('/', asyncRoute(async (req, res) => {
  const item = parseIngredient(req.body);
  const { rows } = await pool.query(
    `INSERT INTO inventory (ingredient_name, unit, quantity_on_hand, reorder_level)
     VALUES ($1, $2, $3, $4) RETURNING inventory_id AS id`,
    [item.name, item.unit, item.onHand, item.reorderLevel],
  );
  res.status(201).json(rows[0]);
}));

// PUT /api/inventory/:id { name, unit, onHand, reorderLevel }
router.put('/:id', asyncRoute(async (req, res) => {
  const id = requireId(req.params.id);
  const item = parseIngredient(req.body);
  const { rowCount } = await pool.query(
    `UPDATE inventory SET ingredient_name = $1, unit = $2, quantity_on_hand = $3,
            reorder_level = $4, updated_at = NOW()
     WHERE inventory_id = $5`,
    [item.name, item.unit, item.onHand, item.reorderLevel, id],
  );
  if (rowCount === 0) throw new HttpError(404, `Ingredient #${id} was not found.`);
  res.json({ id });
}));

export default router;
