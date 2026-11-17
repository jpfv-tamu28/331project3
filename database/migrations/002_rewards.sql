-- Adds phone-number rewards to an existing database without touching its data.
-- Safe to run more than once. Run from psql:  \i database/migrations/002_rewards.sql
BEGIN;

CREATE TABLE IF NOT EXISTS reward_accounts (
    reward_account_id SERIAL PRIMARY KEY,
    phone CHAR(10) NOT NULL UNIQUE,                   -- digits only
    points INT NOT NULL DEFAULT 0 CHECK (points >= 0),
    created_at TIMESTAMP NOT NULL DEFAULT LOCALTIMESTAMP
);

ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS reward_account_id INT REFERENCES reward_accounts (reward_account_id),
    ADD COLUMN IF NOT EXISTS points_earned INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS points_redeemed INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS reward_cents INT NOT NULL DEFAULT 0;

COMMIT;
