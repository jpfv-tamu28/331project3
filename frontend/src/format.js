const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const quantityFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 });
const percentFormat = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 3 });

/** 1950 -> "$19.50" */
export const money = (cents) => currency.format((cents ?? 0) / 100);
/** 19.5 -> "$19.50" */
export const dollars = (value) => currency.format(value ?? 0);
/** "5.25" -> 525, or null if it isn't a valid non-negative amount with at most 2 decimals. */
export function parsePriceCents(text) {
  const trimmed = String(text).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const [whole, frac = ''] = trimmed.split('.');
  return Number(whole) * 100 + Number(frac.padEnd(2, '0'));
}
/** 152400 -> "152,400", 12.5 -> "12.5" */
export const quantity = (n) => quantityFormat.format(n ?? 0);
/** 0.0825 -> "8.25%" */
export const percent = (rate) => percentFormat.format(rate ?? 0);

export const capitalize = (s) => (s ? s[0].toUpperCase() + s.slice(1) : '');

/** Local calendar date as YYYY-MM-DD (toISOString would shift it to UTC). */
export function isoDate(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

/** "2026-11-02" -> "Nov 2, 2026" */
export function longDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** 14 -> "2 PM" */
export function hourLabel(hour) {
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h} ${hour < 12 ? 'AM' : 'PM'}`;
}
