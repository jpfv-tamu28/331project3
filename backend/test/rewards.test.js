import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { maxRewards, normalizePhone, pointsForPayment } from '../../shared/orderRules.js';

describe('normalizePhone', () => {
  it('keeps the 10 digits of a US number however it is typed', () => {
    for (const raw of ['9795550123', '(979) 555-0123', '979.555.0123', '+1 979 555 0123', '19795550123']) {
      assert.equal(normalizePhone(raw), '9795550123', raw);
    }
  });

  it('rejects anything that is not 10 digits', () => {
    for (const raw of ['', '555-0123', '29795550123', '979555012345', null, undefined, 'phone']) {
      assert.equal(normalizePhone(raw), null, String(raw));
    }
  });
});

describe('pointsForPayment', () => {
  it('gives 10 points per dollar, rounding partial points down', () => {
    assert.equal(pointsForPayment(0), 0);
    assert.equal(pointsForPayment(9), 0);
    assert.equal(pointsForPayment(100), 10);
    assert.equal(pointsForPayment(568), 56);
    assert.equal(pointsForPayment(10000), 1000);
  });
});

describe('maxRewards', () => {
  it('is limited by both the points balance and the order total', () => {
    assert.equal(maxRewards(999, 5000), 0);
    assert.equal(maxRewards(3500, 5000), 3);
    assert.equal(maxRewards(10000, 568), 5);
    assert.equal(maxRewards(10000, 99), 0);
  });
});
