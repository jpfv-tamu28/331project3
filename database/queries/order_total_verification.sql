-- Order Total Verification
-- Lists any order whose total does not equal the sum of its line items (expect none).
SELECT
    o.order_id,
    o.total_cents,
    SUM(oi.unit_price_cents * oi.quantity) AS items_total_cents
FROM orders o
JOIN order_items oi ON o.order_id = oi.order_id
GROUP BY o.order_id, o.total_cents
HAVING SUM(oi.unit_price_cents * oi.quantity) <> o.total_cents;
