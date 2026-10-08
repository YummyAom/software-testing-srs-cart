import { describe, expect, it } from 'vitest';
import { validateCheckout } from './index.js';

const validCheckout = {
  zone: 'inCity',
  speed: 'standard',
  lines: [{ productId: 'P1', quantity: 1, available: true, availableStock: 10 }],
  totalWeightGram: 300,
};

// FR-5.1 and FR-5.2.1 step 1: exact defined strings, no coercion.
describe('validateCheckout — SRS DC-1', () => {
  it.each([
    ['INCITY', 'standard'], ['inCity ', 'standard'], ['', 'standard'],
    [null, 'standard'], [undefined, 'standard'], [1, 'standard'], [true, 'standard'],
    [{}, 'standard'], [['inCity'], 'standard'],
    ['inCity', 'STANDARD'], ['inCity', 'express '], ['inCity', ''],
    ['inCity', null], ['inCity', undefined], ['inCity', 1], ['inCity', false],
    ['inCity', {}], ['inCity', ['standard']],
  ] as const)('invalid zone=%s speed=%s precedes empty/unavailable/overweight', (zone, speed) => {
    for (const lines of [[], [{ productId: 'P1', quantity: 10, available: false, availableStock: 0 }]]) {
      expect(validateCheckout({ ...validCheckout, zone, speed, lines, totalWeightGram: 21000 }))
        .toEqual({ result: 'VALIDATION_ERROR' });
    }
  });

  // FR-5.2.1 step 2 follows zone/speed and precedes weight (even conflicting facts).
  it.each([0, 20000, 21000])('empty cart with weight %s => CART_EMPTY', (totalWeightGram) => {
    expect(validateCheckout({ ...validCheckout, lines: [], totalWeightGram })).toEqual({ result: 'CART_EMPTY' });
  });

  // FR-5.2.1 step 3: report every failed product, not just the first; precedes overweight.
  it.each([1200, 21000])('returns all unavailable/short-stock productIds at %s grams and excludes valid lines', (totalWeightGram) => {
    const lines = [
      { productId: 'P1', quantity: 1, available: false, availableStock: 10 },
      { productId: 'P2', quantity: 4, available: true, availableStock: 3 },
      { productId: 'P3', quantity: 1, available: false, availableStock: 0 },
      { productId: 'P4', quantity: 3, available: true, availableStock: 3 },
      { productId: 'P5', quantity: 1, available: true, availableStock: 3 },
    ];
    const result = validateCheckout({ ...validCheckout, lines, totalWeightGram });
    // SRS requires the complete IDs, not an ordering of the returned list.
    expect(result.result === 'ITEMS_UNAVAILABLE' ? { ...result, productIds: result.productIds.toSorted() } : result)
      .toEqual({ result: 'ITEMS_UNAVAILABLE', productIds: ['P1', 'P2', 'P3'] });
    expect(lines).toEqual([
      { productId: 'P1', quantity: 1, available: false, availableStock: 10 },
      { productId: 'P2', quantity: 4, available: true, availableStock: 3 },
      { productId: 'P3', quantity: 1, available: false, availableStock: 0 },
      { productId: 'P4', quantity: 3, available: true, availableStock: 3 },
      { productId: 'P5', quantity: 1, available: true, availableStock: 3 },
    ]);
  });

  // FR-5.2.1 step 4: 20000 permitted, 20001 rejected, after all earlier checks.
  it.each([
    [1, 'OK'], [19999, 'OK'], [20000, 'OK'],
    [20001, 'WEIGHT_LIMIT_EXCEEDED'], [21000, 'WEIGHT_LIMIT_EXCEEDED'],
  ] as const)('valid nonempty cart at %s grams => %s', (totalWeightGram, result) => {
    for (const zone of ['inCity', 'upcountry', 'remote']) {
      for (const speed of ['standard', 'express']) {
        expect(validateCheckout({ ...validCheckout, zone, speed, totalWeightGram })).toEqual({ result });
      }
    }
  });
});
