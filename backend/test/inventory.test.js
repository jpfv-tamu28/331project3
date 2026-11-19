import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { IncomingMessage, ServerResponse } from 'node:http';
import express from 'express';
import { HttpError } from '../src/http.js';
import {
  createInventoryRoutes,
  parseIngredient,
  reorderIngredient,
  reorderLowInventory,
} from '../src/routes/inventory.js';
import {
  REORDER_MULTIPLIER,
  canReorder,
  isLowStock,
  reorderTarget,
} from '../../shared/inventoryRules.js';

function expectHttpError(fn, status, messagePattern) {
  assert.throws(fn, (err) => {
    assert.ok(err instanceof HttpError, `Expected HttpError, got ${err}`);
    assert.equal(err.status, status);
    if (messagePattern) assert.match(err.message, messagePattern);
    return true;
  });
}

async function expectAsyncHttpError(fn, status, messagePattern) {
  await assert.rejects(fn, (err) => {
    assert.ok(err instanceof HttpError, `Expected HttpError, got ${err}`);
    assert.equal(err.status, status);
    if (messagePattern) assert.match(err.message, messagePattern);
    return true;
  });
}

function createTestApp(db) {
  const app = express();
  app.use('/api/inventory', createInventoryRoutes({ db }));
  // Match server.js error handling for HttpError responses.
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    res.status(err.status || 500).json({ error: err.message });
  });
  return app;
}

function invokeApp(app, method, url, body) {
  return new Promise((resolve, reject) => {
    const req = new IncomingMessage(null);
    req.method = method;
    req.url = url;
    req.headers = {};
    if (body !== undefined) req.body = body;

    const res = new ServerResponse(req);
    const chunks = [];
    const origWrite = res.write.bind(res);
    const origEnd = res.end.bind(res);

    res.write = (chunk, encoding, cb) => {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
      return origWrite(chunk, encoding, cb);
    };
    res.end = (chunk, encoding, cb) => {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
      origEnd(chunk, encoding, cb);
      const text = Buffer.concat(chunks).toString('utf8');
      resolve({
        status: res.statusCode,
        body: text ? JSON.parse(text) : null,
      });
    };

    app.handle(req, res, (err) => {
      if (err) reject(err);
    });
  });
}

describe('shared/inventoryRules', () => {
  it('uses a reorder multiplier of 3 and calculates rounded target quantities', () => {
    assert.equal(REORDER_MULTIPLIER, 3);
    assert.equal(reorderTarget(500), 1500);
    assert.equal(reorderTarget(0.1), 0.3);
    assert.equal(reorderTarget(12.345), 37.04);
  });

  it('identifies low-stock and reorderable items including boundary equality', () => {
    assert.equal(isLowStock({ onHand: 450, reorderLevel: 500 }), true);
    assert.equal(isLowStock({ onHand: 500, reorderLevel: 500 }), true);
    assert.equal(isLowStock({ onHand: 501, reorderLevel: 500 }), false);

    assert.equal(canReorder({ onHand: 450, reorderLevel: 500 }), true);
    assert.equal(canReorder({ onHand: 0, reorderLevel: 0 }), false);
    assert.equal(canReorder({ onHand: 501, reorderLevel: 500 }), false);
  });
});

describe('parseIngredient', () => {
  it('accepts and trims valid ingredient payloads', () => {
    const parsed = parseIngredient({
      name: '  Matcha Powder  ',
      unit: ' g ',
      onHand: '450',
      reorderLevel: 500,
    });
    assert.deepEqual(parsed, {
      name: 'Matcha Powder',
      unit: 'g',
      onHand: 450,
      reorderLevel: 500,
    });
  });

  it('rejects empty name, overly long unit, and negative amounts', () => {
    expectHttpError(
      () => parseIngredient({ name: '   ', unit: 'g', onHand: 10, reorderLevel: 5 }),
      400,
      /Ingredient is required/,
    );
    expectHttpError(
      () => parseIngredient({ name: 'Matcha', unit: 'x'.repeat(51), onHand: 10, reorderLevel: 5 }),
      400,
      /Unit must be at most 50 characters/,
    );
    expectHttpError(
      () => parseIngredient({ name: 'Matcha', unit: 'g', onHand: -1, reorderLevel: 5 }),
      400,
      /On hand must be a non-negative number/,
    );
    expectHttpError(
      () => parseIngredient({ name: 'Matcha', unit: 'g', onHand: 10, reorderLevel: -2 }),
      400,
      /Reorder level must be a non-negative number/,
    );
  });
});

describe('reorderIngredient', () => {
  it('updates a low-stock ingredient to 3x reorder_level', async () => {
    const calls = [];
    const updatedRow = {
      id: 4,
      name: 'Matcha Powder',
      unit: 'g',
      onHand: 1500,
      reorderLevel: 500,
      updatedAt: '2026-11-19 14:30:00',
    };
    const fakeDb = {
      async query(sql, params) {
        calls.push({ sql, params });
        return { rows: [updatedRow] };
      },
    };

    const result = await reorderIngredient(fakeDb, 4);
    assert.deepEqual(result, updatedRow);
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].params, [4, 3]);
    assert.match(calls[0].sql, /ROUND\(reorder_level \* \$2::numeric, 2\)/i);
    assert.match(calls[0].sql, /quantity_on_hand <= reorder_level/i);
    assert.match(calls[0].sql, /reorder_level > 0/i);
  });

  it('throws 404 when ingredient does not exist', async () => {
    const fakeDb = {
      async query(sql) {
        if (sql.startsWith('UPDATE inventory')) return { rows: [] };
        return { rows: [] };
      },
    };
    await expectAsyncHttpError(() => reorderIngredient(fakeDb, 999), 404, /Ingredient #999 was not found/);
  });

  it('throws 400 when reorder level is 0 or less', async () => {
    const fakeDb = {
      async query(sql) {
        if (sql.startsWith('UPDATE inventory')) return { rows: [] };
        return { rows: [{ name: 'Water', onHand: 0, reorderLevel: 0 }] };
      },
    };
    await expectAsyncHttpError(
      () => reorderIngredient(fakeDb, 20),
      400,
      /Set a reorder level above 0 before reordering Water/,
    );
  });

  it('throws 409 when ingredient is already above reorder level', async () => {
    const fakeDb = {
      async query(sql) {
        if (sql.startsWith('UPDATE inventory')) return { rows: [] };
        return { rows: [{ name: 'Black Tea Leaves', onHand: 8000, reorderLevel: 3000 }] };
      },
    };
    await expectAsyncHttpError(
      () => reorderIngredient(fakeDb, 1),
      409,
      /Black Tea Leaves is already above its reorder level/,
    );
  });
});

describe('reorderLowInventory', () => {
  it('restocks all matching low-stock items in a single query', async () => {
    const calls = [];
    const items = [
      { id: 4, name: 'Matcha Powder', unit: 'g', onHand: 1500, reorderLevel: 500, updatedAt: '2026-11-19 14:30:00' },
      { id: 26, name: 'Drink Carrier (2-cup)', unit: 'each', onHand: 1200, reorderLevel: 400, updatedAt: '2026-11-19 14:30:00' },
    ];
    const fakeDb = {
      async query(sql, params) {
        calls.push({ sql, params });
        return { rows: items };
      },
    };

    const result = await reorderLowInventory(fakeDb);
    assert.deepEqual(result, { count: 2, items });
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].params, [3]);
    assert.match(calls[0].sql, /ROUND\(reorder_level \* \$1::numeric, 2\)/i);
    assert.match(calls[0].sql, /WHERE quantity_on_hand <= reorder_level/i);
    assert.match(calls[0].sql, /AND reorder_level > 0/i);
  });

  it('returns count 0 and empty items array when nothing is low', async () => {
    const fakeDb = {
      async query() {
        return { rows: [] };
      },
    };

    const result = await reorderLowInventory(fakeDb);
    assert.deepEqual(result, { count: 0, items: [] });
  });
});

describe('inventory HTTP routes', () => {
  it('routes POST /api/inventory/reorder-low before /:id/reorder and returns 200', async () => {
    const restocked = [
      { id: 4, name: 'Matcha Powder', unit: 'g', onHand: 1500, reorderLevel: 500, updatedAt: '2026-11-19 14:30:00' },
    ];
    const app = createTestApp({
      async query(sql) {
        if (sql.includes('WHERE quantity_on_hand <= reorder_level')) {
          return { rows: restocked };
        }
        throw new Error(`Unexpected SQL: ${sql}`);
      },
    });

    const res = await invokeApp(app, 'POST', '/api/inventory/reorder-low');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { count: 1, items: restocked });
  });

  it('handles POST /api/inventory/:id/reorder success and error statuses', async () => {
    const updatedItem = {
      id: 4,
      name: 'Matcha Powder',
      unit: 'g',
      onHand: 1500,
      reorderLevel: 500,
      updatedAt: '2026-11-19 14:30:00',
    };
    const app = createTestApp({
      async query(sql, params) {
        if (sql.startsWith('UPDATE inventory')) {
          return { rows: params[0] === 4 ? [updatedItem] : [] };
        }
        if (sql.startsWith('SELECT ingredient_name')) {
          if (params[0] === 7) {
            return { rows: [{ name: 'Whole Milk', onHand: 200000, reorderLevel: 60000 }] };
          }
          return { rows: [] };
        }
        throw new Error(`Unexpected SQL: ${sql}`);
      },
    });

    const ok = await invokeApp(app, 'POST', '/api/inventory/4/reorder');
    assert.equal(ok.status, 200);
    assert.deepEqual(ok.body, updatedItem);

    const badId = await invokeApp(app, 'POST', '/api/inventory/abc/reorder');
    assert.equal(badId.status, 400);
    assert.match(badId.body.error, /ID must be a positive integer/);

    const missing = await invokeApp(app, 'POST', '/api/inventory/999/reorder');
    assert.equal(missing.status, 404);
    assert.match(missing.body.error, /Ingredient #999 was not found/);

    const alreadyInStock = await invokeApp(app, 'POST', '/api/inventory/7/reorder');
    assert.equal(alreadyInStock.status, 409);
    assert.match(alreadyInStock.body.error, /Whole Milk is already above its reorder level/);
  });
});
