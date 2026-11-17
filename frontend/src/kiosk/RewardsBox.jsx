import { useState } from 'react';
import { Api, errorMessage } from '../api';
import { Stepper } from '../components/Stepper';
import { money } from '../format';
import { POINTS_PER_DOLLAR, POINTS_PER_REWARD, REWARD_CENTS, normalizeEmail } from '../../../shared/orderRules.js';

/**
 * Email rewards in the kiosk cart. Any valid email earns points and gets the receipt; looking it up
 * shows the balance and lets the customer spend whole $1 rewards. `points` is null until looked up.
 */
export default function RewardsBox({ email, onEmailChange, points, onPoints, redeem, maxRedeem, onRedeem }) {
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const valid = normalizeEmail(email) !== null;
  const partial = email.trim().length > 0 && !valid;

  const check = async () => {
    if (!valid || checking) return;
    setChecking(true);
    setError('');
    try {
      onPoints((await Api.rewards(normalizeEmail(email))).points);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="kiosk-rewards">
      <label className="kiosk-cart-label" htmlFor="kiosk-rewards-email">
        Rewards &amp; receipt
      </label>
      <div className="kiosk-rewards-row">
        <input
          id="kiosk-rewards-email"
          className="field"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          aria-invalid={error || partial ? 'true' : undefined}
          aria-describedby={error ? 'kiosk-rewards-error' : partial ? 'kiosk-rewards-partial' : undefined}
          onChange={(e) => onEmailChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && check()}
        />
        <button type="button" className="btn btn-secondary" onClick={check} disabled={!valid || checking}>
          {checking ? 'Checking…' : 'Check points'}
        </button>
      </div>
      {error && <p id="kiosk-rewards-error" role="alert" className="kiosk-rewards-error">{error}</p>}
      {partial && !error && (
        <p id="kiosk-rewards-partial" className="kiosk-rewards-error">
          Finish your email address, or clear it to order without rewards.
        </p>
      )}
      {points === null && !partial && !error && (
        <p className="kiosk-rewards-hint kiosk-rewards-info">
          Earn {POINTS_PER_DOLLAR} points per $1. Every {POINTS_PER_REWARD.toLocaleString()} points is {money(REWARD_CENTS)} off.
        </p>
      )}
      {points !== null && (
        <div className="kiosk-rewards-balance" role="status">
          <span>{points.toLocaleString()} points</span>
          {maxRedeem > 0 ? (
            <span className="kiosk-rewards-redeem">
              Use
              <Stepper small label="$1 rewards to use" value={redeem} min={0} max={maxRedeem} onChange={onRedeem} />
              × {money(REWARD_CENTS)}
            </span>
          ) : (
            <span className="kiosk-rewards-hint">
              {(POINTS_PER_REWARD - (points % POINTS_PER_REWARD)).toLocaleString()} more for {money(REWARD_CENTS)} off
            </span>
          )}
        </div>
      )}
    </div>
  );
}
