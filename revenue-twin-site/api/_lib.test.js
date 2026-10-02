import test from 'node:test';
import assert from 'node:assert/strict';
import { suggestRate, validateInput } from './_lib.js';

test('busy demand raises the comparable target without exceeding the safety band', () => {
  const input = validateInput({ currentRate: 185, comparableMedian: 225, demand: 'busy', eventNote: '' });
  assert.equal(suggestRate(input), 230); // 225 × 1.08 is capped at 185 × 1.25, then rounded to $5.
});

test('quiet demand and unusually low comparables stay within the lower band', () => {
  assert.equal(suggestRate({ currentRate: 200, comparableMedian: 100, demand: 'quiet' }), 160);
});

test('rounding never breaches the stated upper percentage cap', () => {
  assert.equal(suggestRate({ currentRate: 35, comparableMedian: 100, demand: 'busy' }), 40);
});

test('bad prices and unsupported demand labels are rejected', () => {
  assert.throws(() => validateInput({ currentRate: 0, comparableMedian: 225, demand: 'busy' }));
  assert.throws(() => validateInput({ currentRate: 185, comparableMedian: 225, demand: 'unknown' }));
});
