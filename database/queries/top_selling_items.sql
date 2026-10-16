-- Top Selling Items
-- Ranks all menu items by the amount of orders they have appeared in

SELECT
    mi.menu_item_id,
    mi.name AS menu_item,
    mi.category,
    COUNT(DISTINCT oi.order_id) AS orders_appeared_in,
    COALESCE(SUM(oi.quantity), 0) AS total_quantity_sold
FROM menu_items mi
LEFT JOIN order_items oi ON mi.menu_item_id = oi.menu_item_id
GROUP BY mi.menu_item_id, mi.name, mi.category
ORDER BY orders_appeared_in DESC, total_quantity_sold DESC, mi.name;