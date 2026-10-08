import { describe, expect, it } from 'vitest';
import { validateQuantityChange } from './index.js';

const validAdd = {
  operation: 'add' as const,
  quantity: 1,
  productExists: true,
  inCart: false,
  available: true,
  currentQtyInCart: 0,
  availableStock: 10,
};

// FR-2.1/2.5 and FR-2.6 steps 1–2: no coercion; integer range is inclusive.
describe('validateQuantityChange — SRS DC-1', () => {
  it.each([
    [null, 'VALIDATION_ERROR'], [undefined, 'VALIDATION_ERROR'],
    ['1', 'VALIDATION_ERROR'], [true, 'VALIDATION_ERROR'],
    [1.5, 'VALIDATION_ERROR'], [NaN, 'VALIDATION_ERROR'],
    [Infinity, 'VALIDATION_ERROR'], [{}, 'VALIDATION_ERROR'],
    [-1, 'QTY_OUT_OF_RANGE'], [0, 'QTY_OUT_OF_RANGE'],
    [1, 'OK'], [2, 'OK'], [9, 'OK'], [10, 'OK'], [11, 'QTY_OUT_OF_RANGE'],
  ] as const)('validates raw quantity %s before facts => %s', (quantity, expected) => {
    for (const operation of ['add', 'update'] as const) {
      expect(validateQuantityChange({ ...validAdd, operation, inCart: true, quantity })).toBe(expected);
    }
  });

  // FR-2.6 step 3 follows raw quantity checks, and precedes availability/stock.
  it.each([
    ['add', '1', 'VALIDATION_ERROR'], ['update', '1', 'VALIDATION_ERROR'],
    ['add', 0, 'QTY_OUT_OF_RANGE'], ['update', 11, 'QTY_OUT_OF_RANGE'],
    ['add', 1, 'PRODUCT_NOT_FOUND'], ['update', 1, 'ITEM_NOT_IN_CART'],
  ] as const)('%s missing product/cart with quantity %s => %s', (operation, quantity, expected) => {
    expect(validateQuantityChange({
      ...validAdd, operation, quantity, productExists: false, inCart: false,
      available: false, availableStock: 0, currentQtyInCart: 10,
    })).toBe(expected);
  });

  // FR-2.6 step 4 precedes both the combined limit and stock comparison.
  it.each(['add', 'update'] as const)('%s unavailable product wins over quantity/stock conflicts', (operation) => {
    expect(validateQuantityChange({
      ...validAdd, operation, inCart: true, quantity: 10, currentQtyInCart: 8,
      available: false, availableStock: 0,
    })).toBe('PRODUCT_UNAVAILABLE');
  });

  // FR-2.4/2.6 step 5; AC-2: 8+3 exceeds ten before stock is considered.
  it.each([
    [8, 1, 10, 'OK'], [8, 2, 10, 'OK'], [8, 3, 10, 'QTY_OUT_OF_RANGE'],
    [8, 3, 2, 'QTY_OUT_OF_RANGE'],
  ] as const)('add %s+%s with stock %s => %s', (currentQtyInCart, quantity, availableStock, expected) => {
    expect(validateQuantityChange({ ...validAdd, currentQtyInCart, quantity, availableStock })).toBe(expected);
  });

  // FR-2.4.2/2.5.5/2.6 step 6; AC-3: add compares combined qty, update replaces.
  it.each([
    ['add', 2, 1, 3, 'OK'], ['add', 2, 2, 3, 'INSUFFICIENT_STOCK'],
    ['add', 0, 4, 3, 'INSUFFICIENT_STOCK'],
    ['update', 8, 2, 3, 'OK'], ['update', 8, 3, 3, 'OK'],
    ['update', 8, 4, 3, 'INSUFFICIENT_STOCK'],
    ['update', 10, 10, 10, 'OK'],
  ] as const)('%s old=%s input=%s stock=%s => %s', (operation, currentQtyInCart, quantity, availableStock, expected) => {
    expect(validateQuantityChange({
      ...validAdd, operation, productExists: operation === 'add', inCart: operation === 'update',
      currentQtyInCart, quantity, availableStock,
    })).toBe(expected);
  });
});
