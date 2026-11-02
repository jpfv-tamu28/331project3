import { Router } from 'express';
import { pool } from '../db.js';
import { asyncRoute, HttpError, requireDate, requireRange } from '../http.js';

const router = Router();

// Each range report takes $1 = start date and $2 = end date (inclusive; the SQL adds a day).
// Columns ending in _dollars are money; the browser formats them.
const RANGE = "created_at >= $1::date AND created_at < $2::date + 1";
const O_RANGE = "o.created_at >= $1::date AND o.created_at < $2::date + 1";

export const REPORTS = {
  'daily-sales': {
    title: 'Daily Sales',
    sql: `SELECT to_char(DATE(created_at), 'YYYY-MM-DD') AS day, COUNT(*) AS orders,
                 ROUND(SUM(total_cents) / 100.0, 2) AS revenue_dollars,
                 ROUND(AVG(total_cents) / 100.0, 2) AS avg_order_dollars
          FROM orders WHERE ${RANGE} GROUP BY DATE(created_at) ORDER BY DATE(created_at)`,
  },
  'top-items': {
    title: 'Top Selling Items',
    sql: `SELECT mi.name AS item, mi.category, SUM(oi.quantity) AS quantity_sold,
                 ROUND(SUM(oi.quantity * oi.unit_price_cents) / 100.0, 2) AS revenue_dollars
          FROM order_items oi
          JOIN orders o ON o.order_id = oi.order_id
          JOIN menu_items mi ON mi.menu_item_id = oi.menu_item_id
          WHERE ${O_RANGE}
          GROUP BY mi.name, mi.category ORDER BY quantity_sold DESC`,
  },
  'sales-by-hour': {
    title: 'Sales by Hour',
    sql: `SELECT EXTRACT(HOUR FROM created_at)::int AS hour, COUNT(*) AS orders,
                 ROUND(SUM(total_cents) / 100.0, 2) AS revenue_dollars
          FROM orders WHERE ${RANGE} GROUP BY hour ORDER BY hour`,
  },
  'category-sales': {
    title: 'Category Sales',
    sql: `SELECT mi.category, SUM(oi.quantity) AS items_sold,
                 ROUND(SUM(oi.quantity * oi.unit_price_cents) / 100.0, 2) AS revenue_dollars
          FROM order_items oi
          JOIN orders o ON o.order_id = oi.order_id
          JOIN menu_items mi ON mi.menu_item_id = oi.menu_item_id
          WHERE ${O_RANGE}
          GROUP BY mi.category ORDER BY revenue_dollars DESC`,
  },
  'employee-performance': {
    title: 'Employee Performance',
    sql: `SELECT e.name, e.role, COUNT(o.order_id) AS orders,
                 ROUND(SUM(o.total_cents) / 100.0, 2) AS revenue_dollars
          FROM employees e JOIN orders o ON o.employee_id = e.employee_id
          WHERE ${O_RANGE}
          GROUP BY e.employee_id, e.name, e.role ORDER BY orders DESC`,
  },
};

// "revenue_dollars" -> "Revenue", "quantity_sold" -> "Quantity Sold"
function prettyLabel(column) {
  return column.replace(/_dollars$/, '').split('_').filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
}

// GET /api/reports -> [{ key, title }]
router.get('/', (_req, res) => {
  res.json(Object.entries(REPORTS).map(([key, r]) => ({ key, title: r.title })));
});

// GET /api/reports/x-report?date=YYYY-MM-DD
// Hourly sales for one day. Read-only: running it doesn't reset anything.
// Drinks sold counts top-level lines only; add-ons are child rows with a parent_order_item_id.
router.get('/x-report', asyncRoute(async (req, res) => {
  const date = requireDate(req.query.date, 'date');
  const { rows } = await pool.query(
    `SELECT EXTRACT(HOUR FROM o.created_at)::int AS hour, COUNT(*) AS orders,
            COALESCE(SUM(items.qty), 0) AS "drinksSold", SUM(o.total_cents) AS "revenueCents"
     FROM orders o
     LEFT JOIN (SELECT order_id, SUM(quantity) AS qty FROM order_items
                WHERE parent_order_item_id IS NULL GROUP BY order_id) items
       ON items.order_id = o.order_id
     WHERE o.created_at >= $1::date AND o.created_at < $1::date + 1
     GROUP BY hour ORDER BY hour`,
    [date],
  );
  res.json({ date, hours: rows });
}));

// GET /api/reports/product-usage?from=&to=
// Each sold item's quantity times its recipe amounts, summed per ingredient.
router.get('/product-usage', asyncRoute(async (req, res) => {
  const { from, to } = requireRange(req.query);
  const { rows } = await pool.query(
    `SELECT i.ingredient_name AS ingredient, i.unit, SUM(oi.quantity * r.quantity_required) AS amount
     FROM order_items oi
     JOIN orders o ON o.order_id = oi.order_id
     JOIN recipes r ON r.menu_item_id = oi.menu_item_id
     JOIN inventory i ON i.inventory_id = r.inventory_id
     WHERE ${O_RANGE}
     GROUP BY i.ingredient_name, i.unit
     ORDER BY amount DESC`,
    [from, to],
  );
  res.json(rows);
}));

// GET /api/reports/:key?from=&to= -> { title, columns: [{ key, label, money }], rows }
router.get('/:key', asyncRoute(async (req, res) => {
  const report = REPORTS[req.params.key];
  if (!report) throw new HttpError(404, `Unknown report "${req.params.key}".`);
  const { from, to } = requireRange(req.query);
  const result = await pool.query(report.sql, [from, to]);
  const columns = result.fields.map((f) => ({
    key: f.name,
    label: prettyLabel(f.name),
    money: f.name.endsWith('_dollars'),
  }));
  res.json({ title: report.title, columns, rows: result.rows });
}));

export default router;
