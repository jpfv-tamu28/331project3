-- Peak Sales Days
-- Ordered ranking of the days by total value sold
SELECT 
    DATE(created_at) AS sales_day,
    ROUND(SUM(total_cents) / 100.0, 2) AS total_sales_dollars
FROM orders
GROUP BY DATE(created_at)
ORDER BY total_sales_dollars DESC
LIMIT 10;