import { describe, expect, it } from 'vitest';
import { validateProductUpdate } from './index.js';

// FR-9.1.1 step 2: price integer 1..50000 inclusive; no coercion.
describe('validateProductUpdate — SRS DC-1', () => {
  it.each([
    [0, ['price']], [1, []], [2, []], [49999, []], [50000, []], [50001, ['price']],
    [null, ['price']], ['1', ['price']], [true, ['price']], [1.5, ['price']],
    [NaN, ['price']], [Infinity, ['price']], [{}, ['price']], [[1], ['price']],
  ])('validates price %s => invalid fields %s', (price, expected) => {
    expect(validateProductUpdate({ price })).toEqual(expected);
  });

  // FR-9.1.1 step 2: stock integer 0..9999 inclusive; missing price ignored.
  it.each([
    [-1, ['stock']], [0, []], [1, []], [9998, []], [9999, []], [10000, ['stock']],
    [null, ['stock']], ['0', ['stock']], [false, ['stock']], [0.5, ['stock']],
    [NaN, ['stock']], [Infinity, ['stock']], [{}, ['stock']], [[0], ['stock']],
  ])('validates stock %s => invalid fields %s', (stock, expected) => {
    expect(validateProductUpdate({ stock })).toEqual(expected);
  });

  // DESIGN/SOI-05: SRS requires at least one field, but does not specify {} error fields.
  it('DESIGN/SOI-05: no specified fields returns price and stock', () => {
    expect(validateProductUpdate({})).toEqual(['price', 'stock']);
  });

  // FR-9.1.1/AC-16: all invalid specified fields; price then stock (SOI-05 ordering).
  it.each([
    [0, 10000, ['price', 'stock']], [1, 10000, ['stock']],
    [0, 0, ['price']], [50000, 9999, []], [null, '0', ['price', 'stock']],
  ])('price=%s stock=%s returns all invalid fields %s', (price, stock, expected) => {
    expect(validateProductUpdate({ stock, price })).toEqual(expected);
  });

  it('DESIGN raw unknown: present undefined is invalid, missing fields are ignored', () => {
    expect(validateProductUpdate({ price: undefined })).toEqual(['price']);
    expect(validateProductUpdate({ stock: undefined })).toEqual(['stock']);
    expect(validateProductUpdate({ price: undefined, stock: undefined })).toEqual(['price', 'stock']);
  });
});
