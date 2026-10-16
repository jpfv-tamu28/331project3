-- Employee Performance Report
-- How many orders has each employee handled?
SELECT
    e.name,
    e.role,
    COUNT(o.order_id) AS total_orders
FROM employees e
JOIN orders o ON e.employee_id = o.employee_id
GROUP BY e.name, e.role
ORDER BY total_orders DESC;
