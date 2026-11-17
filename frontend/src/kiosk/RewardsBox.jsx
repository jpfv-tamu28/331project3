import { useState } from 'react';
import { Api, errorMessage } from '../api';
import { Stepper } from '../components/Stepper';
import { money } from '../format';
import { POINTS_PER_DOLLAR, POINTS_PER_REWARD, REWARD_CENTS, normalizePhone } from '../../../shared/orderRules.js';

/**
 * Phone-number rewards in the kiosk cart. Any valid number earns points on the order; looking it up
 * shows the balance and lets the customer spend whole $1 rewards. `points` is null until looked up.
 */
export default function RewardsBox({ phone, onPhoneChange, points, onPoints, redeem, maxRedeem, onRedeem }) {
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const valid = normalizePhone(phone) !== null;

  const check = async () => {
    if (!valid || checking) return;
    setChecking(true);
    setError('');
    try {
      onPoints((await Api.rewards(normalizePhone(phone))).points);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="kiosk-rewards">
      <label className="kiosk-cart-label" htmlFor="kiosk-rewards-phone">
        Rewards: {POINTS_PER_DOLLAR} points per $1, {POINTS_PER_REWARD.toLocaleString()} points = {money(REWARD_CENTS)} off
      </label>
      <div className="kiosk-rewards-row">
        <input
          id="kiosk-rewards-phone"
          className="field"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="Phone number"
          value={phone}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? 'kiosk-rewards-error' : undefined}
          onChange={(e) => onPhoneChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && check()}
        />
        <button type="button" className="btn btn-secondary" onClick={check} disabled={!valid || checking}>
          {checking ? 'Checking…' : 'Check points'}
        </button>
      </div>
      {error && <p id="kiosk-rewards-error" role="alert" className="kiosk-rewards-error">{error}</p>}
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
