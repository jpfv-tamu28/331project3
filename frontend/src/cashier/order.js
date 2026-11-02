// Order-line helpers for the cashier screen (Cashier.OrderItem in the Java app).
// All money is in cents; the server re-prices every order from the database, using the same math.

export const TAX_RATE = 0.0825;
export const SIZES = [
  { value: 'S', label: 'Small' },
  { value: 'M', label: 'Medium' },
  { value: 'L', label: 'Large' },
];
export const LEVELS = ['0%', '50%', '100%'];
export const EXTRA_SWEET = '200%';
export const MAX_TOPPING_COUNT = 5;
export const MAX_QUANTITY = 99;

/** Price of one drink with its add-ons, before quantity. */
export function unitCents(line) {
  return line.item.priceCents
    + line.toppings.reduce((sum, t) => sum + t.item.priceCents * t.count, 0);
}

export const lineCents = (line) => unitCents(line) * line.quantity;

/** "Ice: 50%, Sug: 100% + Tapioca Pearls (Boba) ×2, Lychee Jelly" */
export function customizationSummary(line) {
  const toppings = line.toppings
    .map((t) => (t.count > 1 ? `${t.item.name} ×${t.count}` : t.item.name))
    .join(', ');
  return `Ice: ${line.ice}, Sug: ${line.sugar}${toppings ? ` + ${toppings}` : ''}`;
}

export function orderTotals(lines, discountRate = 0) {
  const subtotal = lines.reduce((sum, line) => sum + lineCents(line), 0);
  const tax = Math.round(subtotal * TAX_RATE);
  const discount = Math.round(subtotal * discountRate);
  return { subtotal, tax, discount, total: Math.max(0, subtotal + tax - discount) };
}

/** Shape the server expects for POST /api/orders. */
export function toOrderRequest(lines) {
  return lines.map((line) => ({
    menuItemId: line.item.id,
    size: line.size,
    ice: line.ice,
    sugar: line.sugar,
    quantity: line.quantity,
    toppings: line.toppings.map((t) => ({ menuItemId: t.item.id, count: t.count })),
  }));
}
