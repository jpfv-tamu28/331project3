-- Average Order by Weekday
-- How many orders and how much per order does each day of the week bring in?
SELECT
    TO_CHAR(created_at, 'Day') AS weekday,
    COUNT(*) AS total_orders,
    ROUND(AVG(total_cents) / 100.0, 2) AS avg_order_dollars
FROM orders
GROUP BY TO_CHAR(created_at, 'Day'), EXTRACT(ISODOW FROM created_at)
ORDER BY EXTRACT(ISODOW FROM created_at);
