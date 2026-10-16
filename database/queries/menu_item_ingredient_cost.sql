-- Ingredient Cost of Menu Items
-- Given a specific menu item, how many items from the inventory does that menu item use?
SELECT
    m.menu_item_id,
    m.name AS menu_item,
    COUNT(r.inventory_id) AS inventory_item_count
FROM menu_items m
JOIN recipes r ON m.menu_item_id = r.menu_item_id
GROUP BY m.menu_item_id, m.name
ORDER BY inventory_item_count DESC, m.name;
