-- Orders placed through the web app before the session time-zone fix (backend/src/db.js, SHOP_TIMEZONE)
-- were stamped with LOCALTIMESTAMP while the database session ran in UTC, i.e. 5-6 hours ahead of shop
-- time. Evening orders landed on the next day's reports, hourly reports were shifted, and these rows sort
-- above newer, correctly stamped orders in order history.
--
-- The imported Project 2 history ends at order 81348 (whole-second timestamps, shop hours 10:00-20:59);
-- app orders start at 81349. AT TIME ZONE converts each stamp from UTC to Central time, using CDT (-5)
-- or CST (-6) as appropriate for that date.
--
-- Run ONCE, after the fixed backend is deployed everywhere (orders placed by an old deployment are
-- still UTC). Before running, confirm LAST_UTC_ORDER: the newest order placed by code without the fix.
-- Running it twice would shift those orders back a second time.
--
--   psql -h csce-315-db.engr.tamu.edu -U squad_55 -d squad_55_db -f database/migrations/002_fix_utc_order_timestamps.sql

\set FIRST_APP_ORDER 81349
\set LAST_UTC_ORDER 81391

BEGIN;

-- Preview: stored (UTC) vs corrected (shop time).
SELECT order_id,
       created_at AS stored_utc,
       (created_at AT TIME ZONE 'UTC') AT TIME ZONE 'America/Chicago' AS corrected_local
FROM orders
WHERE order_id BETWEEN :FIRST_APP_ORDER AND :LAST_UTC_ORDER
ORDER BY order_id;

UPDATE orders
SET created_at = (created_at AT TIME ZONE 'UTC') AT TIME ZONE 'America/Chicago'
WHERE order_id BETWEEN :FIRST_APP_ORDER AND :LAST_UTC_ORDER;

COMMIT;
