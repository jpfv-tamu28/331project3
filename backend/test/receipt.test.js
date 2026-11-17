import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { escapeHtml } from '../src/email.js';
import { createOrderRoutes, receiptHtml } from '../src/routes/orders.js';

describe('receiptHtml', () => {
  const order = { id: 42, totalCents: 1199, discountCents: 0 };
  const items = [
    { parentId: null, name: 'Taro Milk Tea (M, 50% ice, 100% sugar)', quantity: 2, unitPriceCents: 550 },
    { parentId: 1, name: 'Tapioca Pearls', quantity: 2, unitPriceCents: 75 },
  ];

  it('lists the order number, each line and the total', () => {
    const html = receiptHtml(order, items);
    assert.match(html, /Order #42/);
    assert.match(html, /2 × Taro Milk Tea/);
    assert.match(html, /\$11\.00/);
    assert.match(html, /\$1\.50/);
    assert.match(html, /\$11\.99/);
    assert.doesNotMatch(html, /Discount/);
  });

  it('shows the discount only when there is one', () => {
    assert.match(receiptHtml({ ...order, discountCents: 120 }, items), /Discount[\s\S]*-\$1\.20/);
  });

  it('shows points earned, points used and the new balance for rewards orders', () => {
    const html = receiptHtml({
      ...order, rewardCents: 200, pointsRedeemed: 2000, pointsEarned: 99, pointsBalance: 1536,
    }, items);
    assert.match(html, /Rewards \(2,000 points\)[\s\S]*-\$2\.00/);
    assert.match(html, /earned <strong>99 points/);
    assert.match(html, /balance: <strong>1,536 points/);
  });

  it('leaves rewards out when the order had no rewards email', () => {
    const html = receiptHtml({ ...order, rewardCents: 0, pointsEarned: 0, pointsBalance: null }, items);
    assert.doesNotMatch(html, /points/i);
  });

  it('escapes item names so menu text cannot inject HTML', () => {
    const html = receiptHtml(order, [{ parentId: null, name: '<b>Boba</b>', quantity: 1, unitPriceCents: 500 }]);
    assert.match(html, new RegExp(escapeHtml('<b>Boba</b>')));
    assert.doesNotMatch(html, /<b>Boba<\/b>/);
  });
});

describe('POST /api/orders with a rewards email', () => {
  let server;
  let baseUrl;
  let sent;
  let resendStatus;
  const realFetch = globalThis.fetch;
  const line = { menuItemId: 1, size: 'M', ice: '50%', sugar: '100%', quantity: 1, toppings: [] };

  before(async () => {
    process.env.RESEND_API_KEY = 'test-key';
    // Stand in for Resend; let the test's own requests through.
    globalThis.fetch = async (url, init) => {
      if (String(url).startsWith('https://api.resend.com/')) {
        sent.push(JSON.parse(init.body));
        return new Response('{}', { status: resendStatus });
      }
      return realFetch(url, init);
    };

    const fakeDb = {
      async query(sql, params = []) {
        if (sql.includes('FROM menu_items')) {
          return { rows: [{ id: 1, name: 'Thai Tea', itemType: 'drink', priceCents: 525 }] };
        }
        if (sql.startsWith('INSERT INTO reward_accounts')) return { rows: [] };
        if (sql.includes('FROM reward_accounts')) return { rows: [{ id: 5, points: 1200 }] };
        if (sql.startsWith('UPDATE reward_accounts')) return { rows: [{ points: 1200 - params[1] + params[2] }] };
        if (sql.startsWith('LOCK TABLE') || sql.startsWith('UPDATE inventory')) return { rows: [] };
        if (sql.includes('INSERT INTO orders')) return { rows: [{ id: 7 }] };
        if (sql.includes('INSERT INTO order_items')) return { rows: [{ id: 70 }] };
        if (sql.includes('FROM order_items WHERE order_id')) {
          return { rows: [{ parentId: null, name: 'Thai Tea (M, 50% ice, 100% sugar)', quantity: 1, unitPriceCents: 525 }] };
        }
        throw new Error(`Unexpected SQL in test: ${sql}`);
      },
    };
    const app = express();
    app.use(express.json());
    app.use('/api/orders', createOrderRoutes({ db: fakeDb, runTransaction: (fn) => fn(fakeDb) }));
    // eslint-disable-next-line no-unused-vars
    app.use((err, _req, res, _next) => res.status(err.status || 500).json({ error: err.message }));
    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        baseUrl = `http://127.0.0.1:${server.address().port}`;
        resolve();
      });
    });
  });

  beforeEach(() => {
    sent = [];
    resendStatus = 200;
  });

  after(async () => {
    globalThis.fetch = realFetch;
    delete process.env.RESEND_API_KEY;
    await new Promise((resolve) => server.close(resolve));
  });

  const order = (extra) => fetch(`${baseUrl}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: [line], ...extra }),
  });

  it('emails the receipt with points to the rewards email', async () => {
    const res = await order({ rewardEmail: 'Guest@TAMU.edu', redeemRewards: 1 });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.receiptSent, true);
    assert.equal(sent.length, 1);
    assert.deepEqual(sent[0].to, ['guest@tamu.edu']);
    assert.match(sent[0].subject, /order #7/);
    // 525 + 43 tax - 100 reward = 468 paid -> 46 points; 1200 - 1000 + 46 = 246
    assert.match(sent[0].html, /Thai Tea/);
    assert.match(sent[0].html, /Rewards \(1,000 points\)/);
    assert.match(sent[0].html, /earned <strong>46 points/);
    assert.match(sent[0].html, /balance: <strong>246 points/);
  });

  it('still places the order when the email fails', async () => {
    resendStatus = 403;
    const res = await order({ rewardEmail: 'guest@tamu.edu' });
    assert.equal(res.status, 201);
    assert.equal((await res.json()).receiptSent, false);
  });

  it('sends nothing without a rewards email', async () => {
    const res = await order({});
    assert.equal(res.status, 201);
    assert.equal(sent.length, 0);
  });
});
