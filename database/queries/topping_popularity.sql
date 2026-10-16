-- Topping Popularity
-- Ranks toppings by total quantity ordered and revenue generated
SELECT 
    oi.item_name_snapshot AS topping_name,
    SUM(oi.quantity) AS times_ordered,
    ROUND(SUM(oi.unit_price_cents * oi.quantity) / 100.0, 2) AS total_revenue_dollars
FROM order_items oi
JOIN menu_items mi ON oi.menu_item_id = mi.menu_item_id
WHERE mi.item_type = 'topping'
GROUP BY oi.item_name_snapshot
ORDER BY times_ordered DESC;
