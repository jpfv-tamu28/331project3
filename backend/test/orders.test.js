import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { HttpError } from '../src/http.js';
import {
  createOrderRoutes,
  lookupDiscount,
  parseLines,
  parseOrderInput,
  priceOrder,
} from '../src/routes/orders.js';
import { MAX_QUANTITY, MAX_TOPPING_COUNT } from '../../shared/orderRules.js';

const SAMPLE_MENU = [
  { id: 1, name: 'Classic Milk Tea', itemType: 'drink', priceCents: 525 },
  { id: 2, name: 'Taro Milk Tea', itemType: 'drink', priceCents: 575 },
  { id: 10, name: 'Tapioca Pearls (Boba)', itemType: 'topping', priceCents: 75 },
  { id: 11, name: 'Lychee Jelly', itemType: 'topping', priceCents: 80 },
];

const validLine = (overrides = {}) => ({
  menuItemId: 1,
  size: 'M',
  ice: '50%',
  sugar: '100%',
  quantity: 1,
  toppings: [],
  ...overrides,
});

function expectHttpError(fn, status, messagePattern) {
  assert.throws(fn, (err) => {
    assert.ok(err instanceof HttpError, `Expected HttpError, got ${err}`);
    assert.equal(err.status, status);
    if (messagePattern) assert.match(err.message, messagePattern);
    return true;
  });
}

describe('lookupDiscount', () => {
  it('matches known codes case-insensitively and trims whitespace', () => {
    assert.deepEqual(lookupDiscount('ILOVEMYVETS'), {
      rate: 0.1,
      label: 'Veteran discount: 10% off this order.',
    });
    assert.equal(lookupDiscount('  ilovemyvets ')?.rate, 0.1);
  });

  it('returns null for blank, non-string, or unknown codes', () => {
    assert.equal(lookupDiscount(undefined), null);
    assert.equal(lookupDiscount(null), null);
    assert.equal(lookupDiscount(''), null);
    assert.equal(lookupDiscount('   '), null);
    assert.equal(lookupDiscount(123), null);
    assert.equal(lookupDiscount('BOGUS50'), null);
  });
});

describe('parseLines', () => {
  it('accepts valid drink customizations and add-ons up to limits', () => {
    const parsed = parseLines([
      validLine({
        menuItemId: '2',
        size: 'L',
        ice: '0%',
        sugar: '200%',
        quantity: MAX_QUANTITY,
        toppings: [{ menuItemId: '10', count: MAX_TOPPING_COUNT }],
      }),
    ]);

    assert.deepEqual(parsed, [
      {
        menuItemId: 2,
        size: 'L',
        ice: '0%',
        sugar: '200%',
        quantity: MAX_QUANTITY,
        toppings: [{ menuItemId: 10, count: MAX_TOPPING_COUNT }],
      },
    ]);
  });

  it('defaults omitted toppings to an empty list', () => {
    const { toppings, ...withoutToppings } = validLine();
    assert.equal(toppings.length, 0);
    const [parsed] = parseLines([withoutToppings]);
    assert.deepEqual(parsed.toppings, []);
  });

  it('rejects empty or non-array items', () => {
    expectHttpError(() => parseLines(undefined), 400, /at least one drink/i);
    expectHttpError(() => parseLines([]), 400, /at least one drink/i);
    expectHttpError(() => parseLines('not-an-array'), 400, /at least one drink/i);
  });

  it('rejects invalid menuItemId values', () => {
    expectHttpError(() => parseLines([validLine({ menuItemId: 0 })]), 400, /Menu item must be a positive integer/);
    expectHttpError(() => parseLines([validLine({ menuItemId: -3 })]), 400, /Menu item must be a positive integer/);
    expectHttpError(() => parseLines([validLine({ menuItemId: 1.5 })]), 400, /Menu item must be a positive integer/);
    expectHttpError(() => parseLines([validLine({ menuItemId: 'abc' })]), 400, /Menu item must be a positive integer/);
  });

  it('enforces quantity bounds and integer check', () => {
    expectHttpError(() => parseLines([validLine({ quantity: 0 })]), 400, /Quantity must be between 1 and 99/);
    expectHttpError(() => parseLines([validLine({ quantity: -1 })]), 400, /Quantity must be between 1 and 99/);
    expectHttpError(
      () => parseLines([validLine({ quantity: MAX_QUANTITY + 1 })]),
      400,
      /Quantity must be between 1 and 99/,
    );
    expectHttpError(() => parseLines([validLine({ quantity: 2.5 })]), 400, /Quantity must be between 1 and 99/);
  });

  it('validates size, ice, and sugar options', () => {
    expectHttpError(() => parseLines([validLine({ size: 'XL' })]), 400, /Size must be S, M or L/);
    expectHttpError(() => parseLines([validLine({ size: 'm' })]), 400, /Size must be S, M or L/);
    expectHttpError(() => parseLines([validLine({ ice: '25%' })]), 400, /Invalid ice level/);
    // 200% is only offered for sugar, not ice.
    expectHttpError(() => parseLines([validLine({ ice: '200%' })]), 400, /Invalid ice level/);
    expectHttpError(() => parseLines([validLine({ sugar: '75%' })]), 400, /Invalid sugar level/);
  });

  it('validates add-on IDs and counts', () => {
    expectHttpError(
      () => parseLines([validLine({ toppings: [{ menuItemId: 0, count: 1 }] })]),
      400,
      /Add-on must be a positive integer/,
    );
    expectHttpError(
      () => parseLines([validLine({ toppings: [{ menuItemId: 10, count: 0 }] })]),
      400,
      /1 to 5 times/,
    );
    expectHttpError(
      () => parseLines([validLine({ toppings: [{ menuItemId: 10, count: MAX_TOPPING_COUNT + 1 }] })]),
      400,
      /1 to 5 times/,
    );
    expectHttpError(
      () => parseLines([validLine({ toppings: [{ menuItemId: 10, count: 1.2 }] })]),
      400,
      /1 to 5 times/,
    );
  });
});

describe('parseOrderInput', () => {
  it('allows unassigned employeeId and defaults paymentMethod to card', () => {
    const parsed = parseOrderInput({ items: [validLine()] });
    assert.equal(parsed.employeeId, null);
    assert.equal(parsed.paymentKey, 'card');
    assert.equal(parsed.paymentMethod, 'Card');
    assert.equal(parsed.discount, null);
  });

  it('normalizes payment methods and validates employeeId and discountCode', () => {
    const parsed = parseOrderInput({
      employeeId: '3',
      paymentMethod: 'GIFTCARD',
      discountCode: 'ilovemyvets',
      items: [validLine()],
    });
    assert.equal(parsed.employeeId, 3);
    assert.equal(parsed.paymentKey, 'giftcard');
    assert.equal(parsed.paymentMethod, 'Gift Card');
    assert.equal(parsed.discount?.rate, 0.1);

    expectHttpError(
      () => parseOrderInput({ employeeId: 0, items: [validLine()] }),
      400,
      /Employee must be a positive integer/,
    );
    expectHttpError(
      () => parseOrderInput({ paymentMethod: 'venmo', items: [validLine()] }),
      400,
      /Payment method must be one of/,
    );
    expectHttpError(
      () => parseOrderInput({ discountCode: 'NOPE', items: [validLine()] }),
      400,
      /not a valid discount code/,
    );
  });
});

describe('priceOrder', () => {
  it('prices a single drink with 8.25% rounded tax and no discount', () => {
    const lines = parseLines([validLine({ menuItemId: 1, quantity: 1 })]);
    const result = priceOrder(lines, SAMPLE_MENU);

    // 525 * 0.0825 = 43.3125 -> 43 cents
    assert.equal(result.subtotalCents, 525);
    assert.equal(result.taxCents, 43);
    assert.equal(result.discountCents, 0);
    assert.equal(result.totalCents, 568);
  });

  it('prices multiple drinks, add-on multiples, quantities, and percentage discount', () => {
    const lines = parseLines([
      // (575 + 75*2 + 80*1) * 2 = 805 * 2 = 1610
      validLine({
        menuItemId: 2,
        quantity: 2,
        toppings: [
          { menuItemId: 10, count: 2 },
          { menuItemId: 11, count: 1 },
        ],
      }),
      // 525 * 1 = 525
      validLine({ menuItemId: 1, quantity: 1 }),
    ]);

    const discount = lookupDiscount('ILOVEMYVETS');
    const result = priceOrder(lines, SAMPLE_MENU, discount);

    // subtotal = 2135; tax = round(2135 * 0.0825 = 176.1375) = 176; discount = round(213.5) = 214
    assert.equal(result.subtotalCents, 2135);
    assert.equal(result.taxCents, 176);
    assert.equal(result.discountCents, 214);
    assert.equal(result.totalCents, 2097);
  });

  it('ignores client-supplied prices in favor of database prices', () => {
    const tampered = parseLines([validLine({ menuItemId: 2, priceCents: 1, totalCents: 1 })]);
    const result = priceOrder(tampered, SAMPLE_MENU);
    assert.equal(result.subtotalCents, 575);
  });

  it('clamps totalCents at zero if a discount exceeds subtotal plus tax', () => {
    const lines = parseLines([validLine({ menuItemId: 1 })]);
    const result = priceOrder(lines, SAMPLE_MENU, { rate: 2 });
    assert.equal(result.totalCents, 0);
  });

  it('throws 409 when a drink or add-on is missing or unavailable', () => {
    const missingDrink = parseLines([validLine({ menuItemId: 999 })]);
    expectHttpError(() => priceOrder(missingDrink, SAMPLE_MENU), 409, /Menu item #999 is no longer available/);

    const missingTopping = parseLines([validLine({ toppings: [{ menuItemId: 888, count: 1 }] })]);
    expectHttpError(() => priceOrder(missingTopping, SAMPLE_MENU), 409, /Menu item #888 is no longer available/);
  });

  it('rejects ordering a topping on its own or a drink as an add-on', () => {
    const toppingAsDrink = parseLines([validLine({ menuItemId: 10 })]);
    expectHttpError(
      () => priceOrder(toppingAsDrink, SAMPLE_MENU),
      400,
      /Tapioca Pearls \(Boba\) can't be ordered on its own/,
    );

    const drinkAsTopping = parseLines([validLine({ menuItemId: 1, toppings: [{ menuItemId: 2, count: 1 }] })]);
    expectHttpError(
      () => priceOrder(drinkAsTopping, SAMPLE_MENU),
      400,
      /Taro Milk Tea can't be ordered as an add-on/,
    );
  });
});

describe('orders HTTP routes', () => {
  let server;
  let baseUrl;
  let recordedInserts;
  let availableMenu;

  before(async () => {
    availableMenu = SAMPLE_MENU;
    recordedInserts = [];

    const fakeClient = {
      async query(sql, params = []) {
        if (sql.includes('FROM menu_items')) {
          const ids = params[0];
          return { rows: availableMenu.filter((m) => ids.includes(m.id)) };
        }
        if (sql.startsWith('LOCK TABLE')) {
          return { rows: [] };
        }
        if (sql.includes('INSERT INTO orders')) {
          recordedInserts.push({ table: 'orders', params });
          return { rows: [{ id: 42 }] };
        }
        if (sql.includes('INSERT INTO order_items')) {
          const id = 100 + recordedInserts.length;
          recordedInserts.push({ table: 'order_items', params });
          return { rows: [{ id }] };
        }
        throw new Error(`Unexpected SQL in test: ${sql}`);
      },
    };

    const app = express();
    app.use(express.json());
    app.use('/api/orders', createOrderRoutes({
      runTransaction: (fn) => fn(fakeClient),
    }));
    // Match server.js error handling for HttpError responses.
    // eslint-disable-next-line no-unused-vars
    app.use((err, _req, res, _next) => {
      res.status(err.status || 500).json({ error: err.message });
    });

    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        baseUrl = `http://127.0.0.1:${server.address().port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
  });

  it('validates discount codes via GET /api/orders/discounts/:code', async () => {
    const ok = await fetch(`${baseUrl}/api/orders/discounts/ilovemyvets`);
    assert.equal(ok.status, 200);
    assert.deepEqual(await ok.json(), {
      code: 'ILOVEMYVETS',
      rate: 0.1,
      label: 'Veteran discount: 10% off this order.',
    });

    const missing = await fetch(`${baseUrl}/api/orders/discounts/INVALID`);
    assert.equal(missing.status, 404);
  });

  it('creates a priced order via POST /api/orders and folds add-on quantities', async () => {
    recordedInserts = [];
    const res = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employeeId: 1,
        paymentMethod: 'cash',
        discountCode: 'ILOVEMYVETS',
        items: [
          {
            menuItemId: 2,
            size: 'L',
            ice: '50%',
            sugar: '200%',
            quantity: 3,
            toppings: [{ menuItemId: 10, count: 2 }],
          },
        ],
      }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    // (575 + 75*2) * 3 = 2175; tax = round(179.4375) = 179; discount = round(217.5) = 218; total = 2136
    assert.deepEqual(body, {
      id: 42,
      subtotalCents: 2175,
      taxCents: 179,
      discountCents: 218,
      totalCents: 2136,
      paymentMethod: 'cash',
    });

    assert.deepEqual(recordedInserts, [
      { table: 'orders', params: [1, 2136, 'Cash'] },
      {
        table: 'order_items',
        params: [42, 2, null, 'Taro Milk Tea (L, 50% ice, 200% sugar)', 3, 575],
      },
      // 2 scoops on 3 drinks = quantity 6, linked to parent order_item_id 101
      {
        table: 'order_items',
        params: [42, 10, 101, 'Tapioca Pearls (Boba)', 6, 75],
      },
    ]);
  });

  it('returns 400 and writes nothing when validation fails', async () => {
    recordedInserts = [];
    const res = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [] }),
    });

    assert.equal(res.status, 400);
    assert.match((await res.json()).error, /at least one drink/i);
    assert.equal(recordedInserts.length, 0);
  });

  it('returns 409 when a requested item is no longer available', async () => {
    recordedInserts = [];
    availableMenu = SAMPLE_MENU.filter((m) => m.id !== 1);

    const res = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [validLine({ menuItemId: 1 })] }),
    });

    assert.equal(res.status, 409);
    assert.match((await res.json()).error, /Menu item #1 is no longer available/);
    assert.equal(recordedInserts.length, 0);
  });
});
