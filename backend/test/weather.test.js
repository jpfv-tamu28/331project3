import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { suggestCategories } from '../src/routes/weather.js';

describe('suggestCategories', () => {
  const pick = (temperatureF, icon) => suggestCategories({ temperatureF, icon }).categories;

  it('suggests icy drinks when it is hot', () => {
    assert.deepEqual(pick(95, 'clear'), ['Slush', 'Fruit/Clear Tea']);
    assert.deepEqual(pick(85, 'partly-cloudy'), ['Slush', 'Fruit/Clear Tea']);
  });

  it('suggests creamy drinks when it is cold', () => {
    assert.deepEqual(pick(40, 'clear'), ['Milk Tea', 'Specialty']);
    assert.deepEqual(pick(59, 'cloudy'), ['Milk Tea', 'Specialty']);
  });

  it('treats rain, storms, snow and fog as cozy weather even when warm', () => {
    for (const icon of ['rain', 'drizzle', 'thunderstorm', 'snow', 'fog']) {
      assert.deepEqual(pick(90, icon), ['Milk Tea', 'Specialty'], icon);
    }
  });

  it('suggests fruit tea first on a mild day', () => {
    assert.deepEqual(pick(60, 'clear'), ['Fruit/Clear Tea', 'Milk Tea']);
    assert.deepEqual(pick(84, 'cloudy'), ['Fruit/Clear Tea', 'Milk Tea']);
  });

  it('always gives a reason to show the customer', () => {
    for (const temp of [30, 70, 100]) assert.ok(suggestCategories({ temperatureF: temp, icon: 'clear' }).reason);
  });
});
