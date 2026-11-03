import { Router } from 'express';
import { pool, withTransaction } from '../db.js';
import { asyncRoute, HttpError, requireId } from '../http.js';
import {
  ICE_LEVELS, MAX_QUANTITY, MAX_TOPPING_COUNT, PAYMENT_METHODS, SIZES, SUGAR_LEVELS, TAX_RATE,
} from '../../../shared/orderRules.js';

const router = Router();

// Active, in-window, not-exhausted code -> discount row, or null. `db` is the pool or a transaction client.
async function lookupDiscount(db, rawCode) {
  if (typeof rawCode !== 'string' || rawCode.trim() === '') return null;
  const { rows: [row] } = await db.query(
    `SELECT discount_code_id AS id, code, description, discount_type AS type,
            discount_value AS value, min_order_cents AS "minOrderCents"
     FROM discount_codes
     WHERE UPPER(code) = $1
       AND is_active
       AND (starts_at IS NULL OR starts_at <= LOCALTIMESTAMP)
       AND (expires_at IS NULL OR expires_at > LOCALTIMESTAMP)
       AND (max_uses IS NULL OR times_used < max_uses)`,
    [rawCode.trim().toUpperCase()],
  );
  return row ?? null;
}

const discountLabel = (d) => d.description
  ?? (d.type === 'PERCENT' ? `${d.value}% off this order.` : `$${(d.value / 100).toFixed(2)} off this order.`);

// Validates a code against this order and claims one use. Call inside the order transaction.
async function redeemDiscount(client, rawCode, subtotalCents) {
  const discount = await lookupDiscount(client, rawCode);
  if (!discount) throw new HttpError(400, `"${rawCode}" is not a valid discount code.`);
  if (subtotalCents < discount.minOrderCents) {
    throw new HttpError(400, `${discount.code} needs an order of at least $${(discount.minOrderCents / 100).toFixed(2)}.`);
  }
  // Guarded UPDATE so two concurrent orders can't both take the last use.
  const { rowCount } = await client.query(
    `UPDATE discount_codes SET times_used = times_used + 1
     WHERE discount_code_id = $1 AND (max_uses IS NULL OR times_used < max_uses)`,
    [discount.id],
  );
  if (rowCount === 0) throw new HttpError(409, `${discount.code} has reached its usage limit.`);
  return discount;
}

function discountAmount(discount, subtotalCents) {
  if (!discount) return 0;
  const raw = discount.type === 'PERCENT'
    ? Math.round((subtotalCents * discount.value) / 100)
    : discount.value;
  return Math.min(raw, subtotalCents); // never discount more than the subtotal
}

// GET /api/orders/discounts/:code -> { code, type, value, rate, minOrderCents, label } or 404
router.get('/discounts/:code', asyncRoute(async (req, res) => {
  const discount = await lookupDiscount(pool, req.params.code);
  if (!discount) {
    res.status(404).json({ error: `"${req.params.code}" is not a valid discount code.` });
    return;
  }
  res.json({
    code: discount.code,
    type: discount.type,
    value: discount.value,
    rate: discount.type === 'PERCENT' ? discount.value / 100 : null, // same field the old endpoint returned
    minOrderCents: discount.minOrderCents,
    label: discountLabel(discount),
  });
}));

// GET /api/orders/discounts -> every code (including inactive/expired) with a computed status, newest first
router.get('/discounts', asyncRoute(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT discount_code_id AS id, code, description, discount_type AS type, discount_value AS value,
            min_order_cents AS "minOrderCents", max_uses AS "maxUses", times_used AS "timesUsed",
            to_char(expires_at, 'YYYY-MM-DD') AS "expiresAt",
            CASE
              WHEN NOT is_active THEN 'Inactive'
              WHEN expires_at IS NOT NULL AND expires_at <= LOCALTIMESTAMP THEN 'Expired'
              WHEN starts_at IS NOT NULL AND starts_at > LOCALTIMESTAMP THEN 'Scheduled'
              WHEN max_uses IS NOT NULL AND times_used >= max_uses THEN 'Used up'
              ELSE 'Active'
            END AS status
     FROM discount_codes
     ORDER BY discount_code_id DESC`,
  );
  res.json(rows);
}));

// POST /api/orders/discounts { code, description?, type, value, minOrderCents?, maxUses?, expiresAt?, isActive? }
// expiresAt is a YYYY-MM-DD date; the code stays valid through the end of that day.
router.post('/discounts', asyncRoute(async (req, res) => {
  const body = req.body ?? {};
  const code = String(body.code ?? '').trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,50}$/.test(code)) {
    throw new HttpError(400, 'Code must be 3 to 50 letters, numbers, dashes or underscores.');
  }
  const type = body.type;
  if (type !== 'PERCENT' && type !== 'FIXED') throw new HttpError(400, 'Type must be PERCENT or FIXED.');
  const value = Number(body.value);
  if (!Number.isInteger(value) || value < 1 || (type === 'PERCENT' && value > 100)) {
    throw new HttpError(400, type === 'PERCENT'
      ? 'Percent must be a whole number from 1 to 100.'
      : 'Fixed discount must be at least 1 cent.');
  }
  const minOrderCents = body.minOrderCents == null ? 0 : Number(body.minOrderCents);
  if (!Number.isInteger(minOrderCents) || minOrderCents < 0) {
    throw new HttpError(400, 'Minimum order must be zero or more.');
  }
  const maxUses = body.maxUses == null ? null : Number(body.maxUses);
  if (maxUses !== null && (!Number.isInteger(maxUses) || maxUses < 1)) {
    throw new HttpError(400, 'Max uses must be 1 or more, or left blank for unlimited.');
  }
  const expiresAt = body.expiresAt == null || body.expiresAt === '' ? null : String(body.expiresAt);
  if (expiresAt !== null && !/^\d{4}-\d{2}-\d{2}$/.test(expiresAt)) {
    throw new HttpError(400, 'Expiry must be a date like 2026-12-31.');
  }
  const description = typeof body.description === 'string' && body.description.trim() !== ''
    ? body.description.trim()
    : null;
  const isActive = body.isActive !== false;

  try {
    const { rows: [row] } = await pool.query(
      `INSERT INTO discount_codes
         (code, description, discount_type, discount_value, min_order_cents, max_uses, expires_at, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, ($7::date + TIME '23:59:59'), $8)
       RETURNING discount_code_id AS id, code`,
      [code, description, type, value, minOrderCents, maxUses, expiresAt, isActive],
    );
    res.status(201).json(row);
  } catch (err) {
    if (err.code === '23505') throw new HttpError(409, `"${code}" already exists.`);
    if (err.code === '22008' || err.code === '22007') throw new HttpError(400, 'Expiry is not a valid date.');
    throw err;
  }
}));

// GET /api/orders?limit=100 -> most recent orders first
router.get('/', asyncRoute(async (req, res) => {
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 100, 1), 500);
  const { rows } = await pool.query(
    `SELECT o.order_id AS id, to_char(o.created_at, 'YYYY-MM-DD HH24:MI:SS') AS "createdAt",
            COALESCE(e.name, 'Employee #' || o.employee_id, 'Unassigned') AS cashier,
            o.status, o.payment_method AS "paymentMethod", o.total_cents AS "totalCents"
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
    if (!SIZES.some((sz) => sz.value === line.size)) throw new HttpError(400, 'Size must be S, M or L.');
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
  const paymentKey = String(req.body?.paymentMethod ?? 'card').toLowerCase();
  const paymentMethod = PAYMENT_METHODS.find((p) => p.value === paymentKey)?.label;
  if (!paymentMethod) {
    throw new HttpError(400, `Payment method must be one of: ${PAYMENT_METHODS.map((p) => p.value).join(', ')}.`);
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
    const rawCode = req.body?.discountCode;
    const discount = typeof rawCode === 'string' && rawCode.trim() !== ''
      ? await redeemDiscount(client, rawCode, subtotalCents)
      : null;
    const discountCents = discountAmount(discount, subtotalCents);
    const totalCents = Math.max(0, subtotalCents + taxCents - discountCents);

    // order_id is not SERIAL, so new IDs are MAX + 1 under a table lock.
    await client.query('LOCK TABLE orders IN SHARE ROW EXCLUSIVE MODE');
    const { rows: [{ id: orderId }] } = await client.query(
      `INSERT INTO orders (order_id, employee_id, status, created_at, total_cents, payment_method,
                           discount_code_id, discount_cents)
       VALUES ((SELECT COALESCE(MAX(order_id), 0) + 1 FROM orders), $1, 'closed', LOCALTIMESTAMP, $2, $3, $4, $5)
       RETURNING order_id AS id`,
      [employeeId, totalCents, paymentMethod, discount?.id ?? null, discountCents],
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
    return { id: orderId, subtotalCents, taxCents, discountCents, totalCents, paymentMethod: paymentKey };
  });

  res.status(201).json(order);
}));

export default router;