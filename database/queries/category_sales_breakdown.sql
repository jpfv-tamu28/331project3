-- Category Sales Breakdown
-- How much revenue does each menu category bring in?
SELECT
    mi.category,
    COUNT(oi.order_item_id) AS items_sold,
    ROUND(SUM(oi.unit_price_cents * oi.quantity) / 100.0, 2) AS revenue_dollars
FROM order_items oi
JOIN menu_items mi ON oi.menu_item_id = mi.menu_item_id
GROUP BY mi.category
ORDER BY revenue_dollars DESC;
