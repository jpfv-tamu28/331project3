import { Router } from 'express';
import { pool, withTransaction } from '../db.js';
import { asyncRoute, HttpError, requireId } from '../http.js';

const router = Router();

export const TAX_RATE = 0.0825;
// Code -> fraction off the subtotal. Kept on the server so the browser can't invent discounts.
const DISCOUNT_CODES = { ILOVEMYVETS: { rate: 0.1, label: 'Veteran discount: 10% off this order.' } };

const SIZES = ['S', 'M', 'L'];
const ICE_LEVELS = ['0%', '50%', '100%'];
const SUGAR_LEVELS = ['0%', '50%', '100%', '200%'];
const MAX_TOPPING_COUNT = 5;
const MAX_QUANTITY = 99;
const PAYMENT_METHODS = ['card', 'cash', 'giftcard'];

function lookupDiscount(code) {
  if (typeof code !== 'string' || code.trim() === '') return null;
  return DISCOUNT_CODES[code.trim().toUpperCase()] ?? null;
}

// GET /api/orders/discounts/:code -> { code, rate, label } or 404
router.get('/discounts/:code', (req, res) => {
  const discount = lookupDiscount(req.params.code);
  if (!discount) {
    res.status(404).json({ error: `"${req.params.code}" is not a valid discount code.` });
    return;
  }
  res.json({ code: req.params.code.trim().toUpperCase(), ...discount });
});

// GET /api/orders?limit=100 -> most recent orders first
router.get('/', asyncRoute(async (req, res) => {
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 100, 1), 500);
  const { rows } = await pool.query(
    `SELECT o.order_id AS id, to_char(o.created_at, 'YYYY-MM-DD HH24:MI:SS') AS "createdAt",
            COALESCE(e.name, 'Employee #' || o.employee_id, 'Unassigned') AS cashier,
            o.status, o.total_cents AS "totalCents"
     FROM orders o LEFT JOIN employees e ON o.employee_id = e.employee_id
     ORDER BY o.created_at DESC, o.order_id DESC LIMIT $1`,
    [limit],
  );
  res.json(rows);
}));

// GET /api/orders/:id/items -> lines of one order, toppings after the drink they belong to
router.get('/:id/items', asyncRoute(async (req, res) => {
  const id = requireId(req.params.id, 'Order ID');
  const { rows } = await pool.query(
    `SELECT order_item_id AS id, parent_order_item_id AS "parentId", item_name_snapshot AS name,
            quantity, unit_price_cents AS "unitPriceCents"
     FROM order_items WHERE order_id = $1 ORDER BY order_item_id`,
    [id],
  );
  res.json(rows);
}));

function parseLines(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new HttpError(400, 'Add at least one drink before finishing payment.');
  }
  return items.map((line) => {
    const menuItemId = requireId(line?.menuItemId, 'Menu item');
    const quantity = Number(line?.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
      throw new HttpError(400, `Quantity must be between 1 and ${MAX_QUANTITY}.`);
    }
    if (!SIZES.includes(line.size)) throw new HttpError(400, 'Size must be S, M or L.');
    if (!ICE_LEVELS.includes(line.ice)) throw new HttpError(400, 'Invalid ice level.');
    if (!SUGAR_LEVELS.includes(line.sugar)) throw new HttpError(400, 'Invalid sugar level.');
    const toppings = (Array.isArray(line.toppings) ? line.toppings : []).map((t) => {
      const count = Number(t?.count);
      if (!Number.isInteger(count) || count < 1 || count > MAX_TOPPING_COUNT) {
        throw new HttpError(400, `Each add-on can be added 1 to ${MAX_TOPPING_COUNT} times.`);
      }
      return { menuItemId: requireId(t?.menuItemId, 'Add-on'), count };
    });
    return { menuItemId, quantity, size: line.size, ice: line.ice, sugar: line.sugar, toppings };
  });
}

// POST /api/orders { employeeId?, items: [{ menuItemId, size, ice, sugar, quantity, toppings: [{ menuItemId, count }] }],
//                    discountCode?, paymentMethod }
// Prices come from the database, not the request, so the total can't be tampered with.
router.post('/', asyncRoute(async (req, res) => {
  // Views are opened without signing in, so an order may have no employee attached (stored as NULL).
  const employeeId = req.body?.employeeId == null ? null : requireId(req.body.employeeId, 'Employee');
  const lines = parseLines(req.body?.items);
  const paymentMethod = String(req.body?.paymentMethod ?? 'card').toLowerCase();
  if (!PAYMENT_METHODS.includes(paymentMethod)) {
    throw new HttpError(400, `Payment method must be one of: ${PAYMENT_METHODS.join(', ')}.`);
  }
  const discount = lookupDiscount(req.body?.discountCode);
  if (req.body?.discountCode && !discount) {
    throw new HttpError(400, `"${req.body.discountCode}" is not a valid discount code.`);
  }

  const order = await withTransaction(async (client) => {
    const ids = [...new Set(lines.flatMap((l) => [l.menuItemId, ...l.toppings.map((t) => t.menuItemId)]))];
    const { rows: menuRows } = await client.query(
      `SELECT menu_item_id AS id, name, item_type AS "itemType", price_cents AS "priceCents"
       FROM menu_items WHERE menu_item_id = ANY($1::int[]) AND is_available`,
      [ids],
    );
    const menu = new Map(menuRows.map((m) => [m.id, m]));
    const find = (id, wantTopping) => {
      const item = menu.get(id);
      if (!item) throw new HttpError(409, `Menu item #${id} is no longer available.`);
      if ((item.itemType === 'topping') !== wantTopping) {
        throw new HttpError(400, `${item.name} can't be ordered ${wantTopping ? 'as an add-on' : 'on its own'}.`);
      }
      return item;
    };

    let subtotalCents = 0;
    const priced = lines.map((line) => {
      const drink = find(line.menuItemId, false);
      const toppings = line.toppings.map((t) => ({ ...t, item: find(t.menuItemId, true) }));
      const unit = drink.priceCents + toppings.reduce((sum, t) => sum + t.item.priceCents * t.count, 0);
      subtotalCents += unit * line.quantity;
      return { ...line, drink, toppings };
    });
    const taxCents = Math.round(subtotalCents * TAX_RATE);
    const discountCents = Math.round(subtotalCents * (discount?.rate ?? 0));
    const totalCents = Math.max(0, subtotalCents + taxCents - discountCents);

    // order_id is not SERIAL, so new IDs are MAX + 1 under a table lock.
    await client.query('LOCK TABLE orders IN SHARE ROW EXCLUSIVE MODE');
    const { rows: [{ id: orderId }] } = await client.query(
      `INSERT INTO orders (order_id, employee_id, status, created_at, total_cents)
       VALUES ((SELECT COALESCE(MAX(order_id), 0) + 1 FROM orders), $1, 'closed', LOCALTIMESTAMP, $2)
       RETURNING order_id AS id`,
      [employeeId, totalCents],
    );

    const insertLine = `INSERT INTO order_items
      (order_id, menu_item_id, parent_order_item_id, item_name_snapshot, quantity, unit_price_cents)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING order_item_id AS id`;
    for (const line of priced) {
      const snapshot = `${line.drink.name} (${line.size}, ${line.ice} ice, ${line.sugar} sugar)`;
      const { rows: [{ id: parentId }] } = await client.query(insertLine,
        [orderId, line.drink.id, null, snapshot, line.quantity, line.drink.priceCents]);
      // One row per add-on, repeats folded into quantity (2 scoops on 3 drinks = 6).
      for (const t of line.toppings) {
        await client.query(insertLine,
          [orderId, t.item.id, parentId, t.item.name, t.count * line.quantity, t.item.priceCents]);
      }
    }
    return { id: orderId, subtotalCents, taxCents, discountCents, totalCents, paymentMethod };
  });

  res.status(201).json(order);
}));

export default router;
