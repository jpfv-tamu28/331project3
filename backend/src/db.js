import pg from 'pg';

// NUMERIC columns come back as strings by default; inventory amounts are small enough for a JS number.
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (value) => (value === null ? null : Number(value)));
// COUNT/SUM return BIGINT, also a string by default; sales totals here stay far below 2^53.
pg.types.setTypeParser(pg.types.builtins.INT8, (value) => (value === null ? null : Number(value)));
// TIMESTAMP (without time zone) is stored as shop-local wall time; keep it as text so it isn't shifted to UTC.
pg.types.setTypeParser(pg.types.builtins.TIMESTAMP, (value) => value);

// Timestamps are stored as shop-local wall time (TIMESTAMP without time zone), so every session must
// use the shop's time zone: otherwise LOCALTIMESTAMP / CURRENT_DATE / NOW() follow the server's (UTC on
// the TAMU server), new orders are stamped hours ahead, and evening orders land on the next day's reports.
export const SHOP_TIMEZONE = process.env.SHOP_TIMEZONE || 'America/Chicago';
if (!/^[A-Za-z0-9_+\-/]+$/.test(SHOP_TIMEZONE)) {
  throw new Error(`SHOP_TIMEZONE "${SHOP_TIMEZONE}" is not a valid time zone name.`);
}

/** Settings for one connection; the pool and the order-notification listener (orderEvents.js) share them. */
export const connectionConfig = {
  options: `-c TimeZone=${SHOP_TIMEZONE}`,
  host: process.env.DB_HOST || 'csce-315-db.engr.tamu.edu',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'squad_55_db',
  user: process.env.DB_USER || 'squad_55',
  password: process.env.DB_PASSWORD,
  // The TAMU server only accepts encrypted connections from off-campus addresses (the Java
  // driver negotiated SSL on its own; node-pg doesn't). Set DB_SSL=false for a local database.
  ssl: process.env.DB_SSL === 'false' ? undefined : { rejectUnauthorized: false },
  connectionTimeoutMillis: 10_000,
};

export const pool = new pg.Pool({
  ...connectionConfig,
  max: Number(process.env.DB_POOL_MAX || 10),
  idleTimeoutMillis: 30_000,
});

pool.on('error', (err) => {
  console.error('[ERROR] Idle PostgreSQL client error:', err.message);
});

/** Runs fn(client) inside BEGIN/COMMIT, rolling back if it throws. */
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
