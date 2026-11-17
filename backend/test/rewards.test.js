import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { maxRewards, normalizeEmail, pointsForPayment } from '../../shared/orderRules.js';

describe('normalizeEmail', () => {
  it('trims and lowercases so the same person always gets the same account', () => {
    assert.equal(normalizeEmail('  Reveille@TAMU.edu '), 'reveille@tamu.edu');
    assert.equal(normalizeEmail('a.b+boba@mail.example.com'), 'a.b+boba@mail.example.com');
  });

  it('rejects obvious typos', () => {
    for (const bad of ['', 'tamu.edu', 'a@b', 'a b@tamu.edu', '@tamu.edu', null, undefined, 42, `${'a'.repeat(250)}@x.co`]) {
      assert.equal(normalizeEmail(bad), null, String(bad));
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
