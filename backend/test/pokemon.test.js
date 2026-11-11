import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DEX_SIZE, dexNumber, toPokemon } from '../src/routes/pokemon.js';

describe('dexNumber', () => {
  it('keeps 1..DEX_SIZE unchanged and wraps larger order numbers back to 1', () => {
    assert.equal(dexNumber(1), 1);
    assert.equal(dexNumber(25), 25);
    assert.equal(dexNumber(DEX_SIZE), DEX_SIZE);
    assert.equal(dexNumber(DEX_SIZE + 1), 1);
    assert.equal(dexNumber(DEX_SIZE * 3 + 25), 25);
  });
});

describe('toPokemon', () => {
  const raw = {
    id: 25,
    name: 'pikachu',
    types: [{ slot: 1, type: { name: 'electric' } }],
    sprites: { front_default: 'small.png', other: { 'official-artwork': { front_default: 'art.png' } } },
  };

  it('keeps dex, name, types and prefers the official artwork', () => {
    assert.deepEqual(toPokemon(raw), { dex: 25, name: 'pikachu', types: ['electric'], sprite: 'art.png' });
  });

  it('falls back to the default sprite when there is no artwork', () => {
    assert.equal(toPokemon({ ...raw, sprites: { front_default: 'small.png', other: {} } }).sprite, 'small.png');
  });
});
