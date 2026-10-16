-- Ingredient Inventory
-- How much of each ingredient/supply is on hand, and is it below its reorder level?
SELECT
    ingredient_name,
    quantity_on_hand,
    unit,
    reorder_level,
    quantity_on_hand < reorder_level AS needs_reorder
FROM inventory
ORDER BY needs_reorder DESC, ingredient_name;
