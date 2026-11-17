import { Router } from 'express';
import { pool } from '../db.js';
import { HttpError, asyncRoute } from '../http.js';
import { normalizePhone } from '../../../shared/orderRules.js';

export function requirePhone(value) {
  const phone = normalizePhone(value);
  if (!phone) throw new HttpError(400, 'Enter a 10-digit phone number.');
  return phone;
}

/**
 * Locks the phone's rewards row for the rest of the transaction, creating it on first use.
 * Locking stops two orders from spending the same points at once.
 */
export async function claimRewardAccount(client, phone) {
  await client.query('INSERT INTO reward_accounts (phone) VALUES ($1) ON CONFLICT (phone) DO NOTHING', [phone]);
  const { rows: [account] } = await client.query(
    'SELECT reward_account_id AS id, points FROM reward_accounts WHERE phone = $1 FOR UPDATE',
    [phone],
  );
  return account;
}

export function createRewardRoutes({ db = pool } = {}) {
  const router = Router();

  // GET /api/rewards/:phone -> { points }; a number with no account yet has 0 points.
  router.get('/:phone', asyncRoute(async (req, res) => {
    const phone = requirePhone(req.params.phone);
    const { rows: [account] } = await db.query('SELECT points FROM reward_accounts WHERE phone = $1', [phone]);
    res.json({ points: account?.points ?? 0 });
  }));

  return router;
}

export default createRewardRoutes();
