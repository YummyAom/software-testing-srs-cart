import { describe, it, expect } from 'vitest';
import { validateQuantityChange } from '@cart/domain';

type ValidateQuantityInput = Parameters<typeof validateQuantityChange>[0];

const defaultAdd: ValidateQuantityInput = {
  operation: 'add',
  quantity: 1,
  productExists: true,
  inCart: false,
  available: true,
  currentQtyInCart: 0,
  availableStock: 20,
};

const defaultUpdate: ValidateQuantityInput = {
  operation: 'update',
  quantity: 1,
  productExists: true,
  inCart: true,
  available: true,
  currentQtyInCart: 3,
  availableStock: 20,
};

describe('validateQuantityChange (FR-2.1–2.6)', () => {
  describe('2.1 Robust BVA of quantity (FR-2.1.2, FR-2.5.2)', () => {
    it.each([
      ['UT-QTY-01', 'add', 0, 'QTY_OUT_OF_RANGE', 'min - 1'],
      ['UT-QTY-02', 'add', 1, 'OK', 'min'],
      ['UT-QTY-03', 'add', 2, 'OK', 'min + 1'],
      ['UT-QTY-04', 'add', 5, 'OK', 'nom'],
      ['UT-QTY-05', 'add', 9, 'OK', 'max - 1'],
      ['UT-QTY-06', 'add', 10, 'OK', 'max'],
      ['UT-QTY-07', 'add', 11, 'QTY_OUT_OF_RANGE', 'max + 1'],
      ['UT-QTY-08', 'update', 0, 'QTY_OUT_OF_RANGE', 'min - 1'],
      ['UT-QTY-09', 'update', 1, 'OK', 'min'],
      ['UT-QTY-10', 'update', 2, 'OK', 'min + 1'],
      ['UT-QTY-11', 'update', 5, 'OK', 'nom'],
      ['UT-QTY-12', 'update', 9, 'OK', 'max - 1'],
      ['UT-QTY-13', 'update', 10, 'OK', 'max'],
      ['UT-QTY-14', 'update', 11, 'QTY_OUT_OF_RANGE', 'max + 1'],
    ] as const)('%s: operation=%s quantity=%d => %s (%s)', (_id, operation, quantity, expected, _note) => {
      const base = operation === 'add' ? defaultAdd : defaultUpdate;
      expect(validateQuantityChange({ ...base, quantity })).toBe(expected);
    });
  });

  describe('2.2 ECT: non-integer quantity (FR-2.1.1, FR-2.5.1)', () => {
    it.each([
      ['UT-QTY-15', 'add', 1.5, 'decimal'],
      ['UT-QTY-16', 'add', '3', 'string'],
      ['UT-QTY-17', 'add', null, 'null'],
      ['UT-QTY-18', 'add', true, 'boolean'],
      ['UT-QTY-19', 'update', 1.5, 'decimal'],
    ])('%s: operation=%s quantity=%s (%s) => VALIDATION_ERROR', (_id, operation, quantity, _note) => {
      const base = operation === 'add' ? defaultAdd : defaultUpdate;
      expect(validateQuantityChange({ ...base, quantity })).toBe('VALIDATION_ERROR');
    });
  });

  describe('2.3 BVA of resulting quantity after add (FR-2.4.1)', () => {
    it.each([
      ['UT-QTY-20', 8, 1, 'OK', 'total = 9'],
      ['UT-QTY-21', 8, 2, 'OK', 'total = 10 (max)'],
      ['UT-QTY-22', 8, 3, 'QTY_OUT_OF_RANGE', 'total = 11 (max + 1, AC-2)'],
    ] as const)('%s: currentQtyInCart=%d + quantity=%d => %s (%s)', (_id, currentQtyInCart, quantity, expected, _note) => {
      expect(validateQuantityChange({ ...defaultAdd, currentQtyInCart, quantity })).toBe(expected);
    });
  });

  describe('2.4 BVA against stock (FR-2.4.2, FR-2.5.5)', () => {
    it.each([
      ['UT-QTY-23', 'add', 2, 1, 3, 'OK', 'add: 2 + 1 = 3 == stock'],
      ['UT-QTY-24', 'add', 2, 2, 3, 'INSUFFICIENT_STOCK', 'add: 2 + 2 = 4 > stock (AC-3)'],
      ['UT-QTY-25', 'update', 3, 3, 3, 'OK', 'update: new 3 == stock'],
      ['UT-QTY-26', 'update', 3, 4, 3, 'INSUFFICIENT_STOCK', 'update: new 4 > stock'],
    ] as const)('%s: op=%s current=%d qty=%d stock=%d => %s (%s)', (_id, operation, currentQtyInCart, quantity, availableStock, expected, _note) => {
      const base = operation === 'add' ? defaultAdd : defaultUpdate;
      expect(validateQuantityChange({ ...base, currentQtyInCart, quantity, availableStock })).toBe(expected);
    });
  });

  describe('2.5 Update replaces quantity instead of accumulating (FR-2.5.6)', () => {
    it('UT-QTY-27: update current 8 with new 10 should succeed without adding to 18', () => {
      expect(validateQuantityChange({ ...defaultUpdate, currentQtyInCart: 8, quantity: 10, availableStock: 20 })).toBe('OK');
    });
  });

  describe('2.6 Steps 3–4: Product existence & availability (FR-2.2, FR-2.5.3, FR-2.5.4)', () => {
    it.each([
      ['UT-QTY-28', 'add', { productExists: false }, 'PRODUCT_NOT_FOUND'],
      ['UT-QTY-29', 'update', { inCart: false }, 'ITEM_NOT_IN_CART'],
      ['UT-QTY-30', 'add', { available: false }, 'PRODUCT_UNAVAILABLE'],
      ['UT-QTY-31', 'update', { available: false }, 'PRODUCT_UNAVAILABLE'],
    ] as const)('%s: op=%s condition=%j => %s', (_id, operation, override, expected) => {
      const base = operation === 'add' ? defaultAdd : defaultUpdate;
      expect(validateQuantityChange({ ...base, ...override })).toBe(expected);
    });
  });

  describe('2.7 Precedence testing: multiple errors prioritize first step (FR-2.6)', () => {
    it.each([
      ['UT-QTY-32', 'add', { quantity: 1.5, productExists: false }, 'VALIDATION_ERROR', 'step 1 beats step 3'],
      ['UT-QTY-33', 'add', { quantity: 0, productExists: false }, 'QTY_OUT_OF_RANGE', 'step 2 beats step 3'],
      ['UT-QTY-34', 'add', { productExists: false, available: false }, 'PRODUCT_NOT_FOUND', 'step 3 beats step 4'],
      ['UT-QTY-35', 'add', { available: false, currentQtyInCart: 8, quantity: 3 }, 'PRODUCT_UNAVAILABLE', 'step 4 beats step 5'],
      ['UT-QTY-36', 'add', { currentQtyInCart: 8, quantity: 3, availableStock: 5 }, 'QTY_OUT_OF_RANGE', 'step 5 beats step 6'],
      ['UT-QTY-37', 'update', { inCart: false, available: false }, 'ITEM_NOT_IN_CART', 'step 3 beats step 4'],
    ] as const)('%s: op=%s overrides=%j => %s (%s)', (_id, operation, override, expected, _note) => {
      const base = operation === 'add' ? defaultAdd : defaultUpdate;
      expect(validateQuantityChange({ ...base, ...override })).toBe(expected);
    });
  });
});

