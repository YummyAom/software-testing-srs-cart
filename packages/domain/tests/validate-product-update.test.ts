import { describe, it, expect } from 'vitest';
import { validateProductUpdate } from '@cart/domain';

describe('validateProductUpdate (FR-9.1.1 Step 2)', () => {
  describe('3.1 Single-Fault Robust BVA (6n + 1 cases)', () => {
    it.each([
      ['UT-PROD-01', 25000, 5000, [], 'nom, nom'],
      ['UT-PROD-02', 0, 5000, ['price'], 'price min - 1'],
      ['UT-PROD-03', 1, 5000, [], 'price min'],
      ['UT-PROD-04', 2, 5000, [], 'price min + 1'],
      ['UT-PROD-05', 49999, 5000, [], 'price max - 1'],
      ['UT-PROD-06', 50000, 5000, [], 'price max'],
      ['UT-PROD-07', 50001, 5000, ['price'], 'price max + 1'],
      ['UT-PROD-08', 25000, -1, ['stock'], 'stock min - 1'],
      ['UT-PROD-09', 25000, 0, [], 'stock min'],
      ['UT-PROD-10', 25000, 1, [], 'stock min + 1'],
      ['UT-PROD-11', 25000, 9998, [], 'stock max - 1'],
      ['UT-PROD-12', 25000, 9999, [], 'stock max'],
      ['UT-PROD-13', 25000, 10000, ['stock'], 'stock max + 1'],
    ])('%s: price=%s, stock=%s => %j (%s)', (_id, price, stock, expected) => {
      const actual = validateProductUpdate({ price, stock });
      expect([...actual].sort()).toEqual([...expected].sort());
    });
  });

  describe('3.2 ECT: non-integer data types', () => {
    it.each([
      ['UT-PROD-14', 1.5, 5000, ['price'], 'price decimal'],
      ['UT-PROD-15', '500', 5000, ['price'], 'price string'],
      ['UT-PROD-16', null, 5000, ['price'], 'price null'],
      ['UT-PROD-17', 25000, 2.5, ['stock'], 'stock decimal'],
      ['UT-PROD-18', 25000, '10', ['stock'], 'stock string'],
      ['UT-PROD-19', 25000, null, ['stock'], 'stock null'],
    ])('%s: price=%s, stock=%s => %j (%s)', (_id, price, stock, expected) => {
      const actual = validateProductUpdate({ price, stock });
      expect([...actual].sort()).toEqual([...expected].sort());
    });
  });

  describe('3.3 Multiple invalid fields and partial inputs', () => {
    it.each([
      ['UT-PROD-20', { price: 0, stock: 10000 }, ['price', 'stock'], 'both fields invalid (AC-16)'],
      ['UT-PROD-21', { price: 500 }, [], 'only price supplied and valid'],
      ['UT-PROD-22', { stock: 10 }, [], 'only stock supplied and valid'],
      ['UT-PROD-23', { price: 0 }, ['price'], 'only price supplied and invalid'],
    ])('%s: input=%j => %j (%s)', (_id, input, expected) => {
      const actual = validateProductUpdate(input);
      expect([...actual].sort()).toEqual([...expected].sort());
    });
  });
});

