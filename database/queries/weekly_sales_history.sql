-- Weekly Sales History
-- Shows count of all orders over a given week
SELECT 
    DATE_TRUNC('week', created_at) AS order_week,
    COUNT(order_id) AS total_orders
FROM orders
GROUP BY DATE_TRUNC('week', created_at)
ORDER BY order_week;
