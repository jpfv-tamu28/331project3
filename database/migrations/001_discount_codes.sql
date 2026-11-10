-- Adds discount codes to an existing database without touching its data.
-- Safe to run more than once. Run from psql:  \i database/migrations/001_discount_codes.sql
BEGIN;

CREATE TABLE IF NOT EXISTS discount_codes (
    discount_code_id SERIAL PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('PERCENT', 'FIXED')),
    discount_value INT NOT NULL CHECK (discount_value > 0),   -- percent (1-100) or cents
    min_order_cents INT NOT NULL DEFAULT 0,
    max_uses INT,                                             -- NULL = unlimited
    times_used INT NOT NULL DEFAULT 0,
    starts_at TIMESTAMP,
    expires_at TIMESTAMP,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    CHECK (discount_type <> 'PERCENT' OR discount_value <= 100),
    CHECK (expires_at IS NULL OR starts_at IS NULL OR expires_at > starts_at)
);

-- Columns POST /api/orders writes. Existing orders get no code and a 0 discount.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20) NOT NULL DEFAULT 'Card'
    CHECK (payment_method IN ('Card', 'Cash', 'Gift Card'));
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_code_id INT
    REFERENCES discount_codes(discount_code_id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_cents INT NOT NULL DEFAULT 0
    CHECK (discount_cents >= 0);

-- The code that used to be hard-coded in orders.js.
INSERT INTO discount_codes (code, description, discount_type, discount_value)
VALUES ('ILOVEMYVETS', 'Veteran discount: 10% off this order.', 'PERCENT', 10)
ON CONFLICT (code) DO NOTHING;

COMMIT;
