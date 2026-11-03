import { describe, it, expect } from 'vitest';
import { validateCheckout } from '@cart/domain';

describe('validateCheckout - ECP Weak Robust', () => {
  const ready = { productId: 'P1', quantity: 1, available: true, availableStock: 20 };
  const closed = { productId: 'P1', quantity: 1, available: false, availableStock: 20 };

  it.each([
    ['TC1', 'inCity', 'standard',  [ready],  1500,  { result: 'OK' }],
    ['TC2', 'abroad', 'standard',  [ready],  1500,  { result: 'VALIDATION_ERROR' }],
    ['TC3', 'inCity', 'overnight', [ready],  1500,  { result: 'VALIDATION_ERROR' }],
    ['TC4', 'inCity', 'standard',  [],       1500,  { result: 'CART_EMPTY' }],
    ['TC5', 'inCity', 'standard',  [closed], 1500,  { result: 'ITEMS_UNAVAILABLE', productIds: ['P1'] }],
    ['TC6', 'inCity', 'standard',  [ready],  24000, { result: 'WEIGHT_LIMIT_EXCEEDED' }],
  ])('%s: zone=%s speed=%s weight=%d', (_tc, zone, speed, lines, totalWeightGram, expected) => {
    expect(validateCheckout({ zone, speed, lines, totalWeightGram })).toEqual(expected);
  });
});
