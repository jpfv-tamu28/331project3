// Stock status, forecasts and restock suggestions for inventory rows from GET /api/inventory
// ({ onHand, reorderLevel, dailyUse, usedIn, ... }).

/** Must match USAGE_WINDOW_DAYS in backend/src/routes/inventory.js. */
export const USAGE_WINDOW_DAYS = 28;
/** An ingredient expected to reach its reorder level within this many days is flagged. */
export const SOON_DAYS = 7;
/** Suggested restocks cover this many days of usage above the reorder level. */
export const COVER_DAYS = 14;

export const STATUS = {
  out: { group: 'Out of stock', badge: { text: 'Out of stock', alert: true } },
  low: { group: 'Below reorder level', badge: { text: 'Low stock', alert: true } },
  soon: { group: 'Reorder soon', badge: { text: 'Reorder soon' } },
  ok: { group: 'In stock', badge: null },
};
/** Groups shown first in the list, most urgent at the top. */
export const URGENT_GROUPS = [STATUS.out.group, STATUS.low.group, STATUS.soon.group];

/** Days until the ingredient runs out at its recent rate, or null if it hasn't been used. */
export function daysOfStock(i) {
  return i.dailyUse > 0 ? i.onHand / i.dailyUse : null;
}

/** Days until on hand drops to the reorder level, or null if it hasn't been used. */
export function daysUntilReorder(i) {
  return i.dailyUse > 0 ? Math.max(0, i.onHand - i.reorderLevel) / i.dailyUse : null;
}

export function stockStatus(i) {
  if (i.onHand <= 0) return 'out';
  if (i.onHand <= i.reorderLevel) return 'low';
  const days = daysUntilReorder(i);
  if (days !== null && days <= SOON_DAYS) return 'soon';
  return 'ok';
}

export const needsAttention = (i) => stockStatus(i) !== 'ok';

/**
 * How much to order so stock reaches the reorder level plus a cushion: COVER_DAYS of recent usage,
 * or the reorder level again when usage is low. 0 when the ingredient doesn't need restocking.
 */
export function suggestedRestock(i) {
  if (!needsAttention(i)) return 0;
  const cushion = Math.max(i.reorderLevel, COVER_DAYS * (i.dailyUse ?? 0));
  const need = i.reorderLevel + cushion - i.onHand;
  return need > 0 ? Math.ceil(need) : 0;
}

/** "~12 days of stock", "Over a year of stock", or "No recent use". */
export function describeSupply(i) {
  const days = daysOfStock(i);
  if (days === null) return 'No recent use';
  if (days >= 365) return 'Over a year of stock';
  if (days < 1) return 'Less than a day of stock';
  const whole = Math.floor(days);
  return `~${whole} day${whole === 1 ? '' : 's'} of stock`;
}

function csvCell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  // Quote cells with separators/quotes; prefix formula-looking text so spreadsheets don't execute it.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\n\r]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

/** Inventory as CSV text, e.g. to send a supplier order or to keep a stock-count record. */
export function inventoryCsv(items) {
  const header = ['Ingredient', 'Unit', 'On hand', 'Reorder level', `Avg daily use (last ${USAGE_WINDOW_DAYS} days)`,
    'Days of stock', 'Status', 'Suggested restock', 'Used in menu items', 'Last updated'];
  const rows = items.map((i) => {
    const days = daysOfStock(i);
    return [i.name, i.unit, i.onHand, i.reorderLevel, i.dailyUse ?? 0, days === null ? '' : Math.floor(days),
      STATUS[stockStatus(i)].group, suggestedRestock(i), i.usedIn ?? 0, i.updatedAt];
  });
  return [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
}
