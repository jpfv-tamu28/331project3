-- Menu Items per Category
-- How many menu items are offered in each category?
SELECT
    category,
    COUNT(*) AS number_of_items
FROM menu_items
GROUP BY category
ORDER BY number_of_items DESC;
