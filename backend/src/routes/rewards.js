import { Router } from 'express';
import { pool } from '../db.js';
import { HttpError, asyncRoute } from '../http.js';
import { normalizeEmail } from '../../../shared/orderRules.js';

export function requireEmail(value) {
  const email = normalizeEmail(value);
  if (!email) throw new HttpError(400, 'Enter a valid email address.');
  return email;
}

/**
 * Locks the email's rewards row for the rest of the transaction, creating it on first use.
 * Locking stops two orders from spending the same points at once.
 */
export async function claimRewardAccount(client, email) {
  await client.query('INSERT INTO reward_accounts (email) VALUES ($1) ON CONFLICT (email) DO NOTHING', [email]);
  const { rows: [account] } = await client.query(
    'SELECT reward_account_id AS id, points FROM reward_accounts WHERE email = $1 FOR UPDATE',
    [email],
  );
  return account;
}

export function createRewardRoutes({ db = pool } = {}) {
  const router = Router();

  // GET /api/rewards?email= -> { points }; an email with no account yet has 0 points.
  router.get('/', asyncRoute(async (req, res) => {
    const email = requireEmail(req.query.email);
    const { rows: [account] } = await db.query('SELECT points FROM reward_accounts WHERE email = $1', [email]);
    res.json({ points: account?.points ?? 0 });
  }));

  return router;
}

export default createRewardRoutes();
