-- Realistic Sales History (by Hour)
-- Shows all of the orders and their details in each previous hour

SELECT 
    EXTRACT(HOUR FROM created_at) AS order_hour,
    COUNT(order_id) AS total_orders,
    ROUND(SUM(total_cents) / 100.0, 2) AS total_sales_dollars
FROM orders
GROUP BY EXTRACT(HOUR FROM created_at)
ORDER BY order_hour;
