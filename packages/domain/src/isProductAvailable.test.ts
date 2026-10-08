import { describe, expect, it } from 'vitest';
import { isProductAvailable } from './index.js';

// SRS definitions and FR-1.3/2.2: on sale AND at least one available unit.
describe('isProductAvailable — SRS DC-1', () => {
  it.each([
    [true, 0, false],
    [true, 1, true],
    [true, 3, true],
    [false, 0, false],
    [false, 1, false],
    [false, 3, false],
  ] as const)('onSale=%s, stock=%s => %s', (onSale, stock, expected) => {
    expect(isProductAvailable(onSale, stock)).toBe(expected);
  });
});
