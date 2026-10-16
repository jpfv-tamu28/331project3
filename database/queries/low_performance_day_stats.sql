-- Low Performance Day Statistics
-- For each week, find the day with the lowest total sales, show the sales amount, and identify the top-selling menu item on that day.

WITH daily_sales AS (
    SELECT
        DATE_TRUNC('week', created_at) AS order_week,
        DATE(created_at) AS sales_day,
        SUM(total_cents) AS day_total_cents
    FROM orders
    GROUP BY DATE_TRUNC('week', created_at), DATE(created_at)
),
worst_days AS (
    SELECT DISTINCT ON (order_week)
        order_week,
        sales_day,
        ROUND(day_total_cents / 100.0, 2) AS lowest_sales_dollars
    FROM daily_sales
    ORDER BY order_week, day_total_cents ASC
),
top_sellers AS (
    SELECT DISTINCT ON (DATE(o.created_at))
        DATE(o.created_at) AS sales_day,
        oi.item_name_snapshot AS top_seller,
        SUM(oi.quantity) AS qty_sold
    FROM orders o
    JOIN order_items oi ON o.order_id = oi.order_id
    JOIN menu_items mi ON oi.menu_item_id = mi.menu_item_id
    WHERE mi.item_type = 'drink'
    GROUP BY DATE(o.created_at), oi.item_name_snapshot
    ORDER BY DATE(o.created_at), qty_sold DESC
)
SELECT
    w.order_week,
    w.sales_day,
    w.lowest_sales_dollars,
    t.top_seller,
    t.qty_sold
FROM worst_days w
LEFT JOIN top_sellers t ON w.sales_day = t.sales_day
ORDER BY w.order_week;
