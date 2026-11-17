// Order rules used by both the API (validation, pricing) and the React app (options, totals),
// so the two can't drift apart.

export const TAX_RATE = 0.0825;

export const ITEM_TYPES = ['drink', 'topping'];

export const SIZES = [
  { value: 'S', label: 'Small' },
  { value: 'M', label: 'Medium' },
  { value: 'L', label: 'Large' },
];

// Both go in 25% steps: ice tops out at 100%, sugar at 150%.
const percentSteps = (max) => Array.from({ length: max / 25 + 1 }, (_, i) => `${i * 25}%`);
export const ICE_LEVELS = percentSteps(100); // 0%, 25%, 50%, 75%, 100%
export const SUGAR_LEVELS = percentSteps(150); // 0% … 150%

export const MAX_TOPPING_COUNT = 5;
export const MAX_QUANTITY = 99;

// label is also the value stored in orders.payment_method (its CHECK constraint allows exactly these).
export const PAYMENT_METHODS = [
  { value: 'card', label: 'Card' },
  { value: 'cash', label: 'Cash' },
  { value: 'giftcard', label: 'Gift Card' },
];

// Rewards: customers earn points on what they pay and trade 1,000 points for $1 off.
export const POINTS_PER_DOLLAR = 10;
export const POINTS_PER_REWARD = 1000;
export const REWARD_CENTS = 100;

/** Points earned for paying `paidCents`; partial points round down. */
export const pointsForPayment = (paidCents) => Math.floor((paidCents * POINTS_PER_DOLLAR) / 100);

/** How many $1 rewards a balance can pay for on an order of `totalCents`. */
export const maxRewards = (points, totalCents) => Math.max(0,
  Math.min(Math.floor(points / POINTS_PER_REWARD), Math.floor(totalCents / REWARD_CENTS)));

// Deliberately loose: Resend does the real validation, this just rejects obvious typos early.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Rewards email -> trimmed and lowercased (so Me@x.com and me@x.com share points), or null. */
export function normalizeEmail(raw) {
  const email = String(raw ?? '').trim().toLowerCase();
  return email.length <= 254 && EMAIL_PATTERN.test(email) ? email : null;
}
