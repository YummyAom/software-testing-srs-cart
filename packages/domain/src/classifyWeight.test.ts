import { describe, expect, it } from 'vitest';
import { classifyWeight } from './index.js';

// FR-4.5 table and FR-5.2.1: all positive deliverable gram values plus over-limit.
// Zero/negative are unspecified (SOI-06), deliberately not SRS oracles.
describe('classifyWeight — SRS DC-1', () => {
  it.each([
    [1, 1000, 'light'], [1001, 5000, 'medium'], [5001, 20000, 'heavy'],
  ] as const)('%s..%s grams => %s (inclusive)', (minimum, maximum, expected) => {
    for (let grams = minimum; grams <= maximum; grams++) {
      expect(classifyWeight(grams), `${grams} grams`).toBe(expected);
    }
  });

  it.each([20001, 21000, 70000])('%s grams => overLimit', (grams) => {
    expect(classifyWeight(grams)).toBe('overLimit');
  });
});
