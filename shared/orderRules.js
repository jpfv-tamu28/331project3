// Order rules used by both the API (validation, pricing) and the React app (options, totals),
// so the two can't drift apart.

export const TAX_RATE = 0.0825;

export const ITEM_TYPES = ['drink', 'topping'];

export const SIZES = [
  { value: 'S', label: 'Small' },
  { value: 'M', label: 'Medium' },
  { value: 'L', label: 'Large' },
];

export const LEVELS = ['0%', '50%', '100%'];
// Sugar only: offered as a separate toggle rather than a regular level.
export const EXTRA_SWEET = '200%';
export const ICE_LEVELS = LEVELS;
export const SUGAR_LEVELS = [...LEVELS, EXTRA_SWEET];

export const MAX_TOPPING_COUNT = 5;
export const MAX_QUANTITY = 99;

// label is also the value stored in orders.payment_method (its CHECK constraint allows exactly these).
export const PAYMENT_METHODS = [
  { value: 'card', label: 'Card' },
  { value: 'cash', label: 'Cash' },
  { value: 'giftcard', label: 'Gift Card' },
];
