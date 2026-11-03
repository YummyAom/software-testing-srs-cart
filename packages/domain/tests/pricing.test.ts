import { describe, it, expect } from 'vitest';
import { calculateSubtotal, calculateTotalWeight, calculateNetTotal, classifyWeight, calculateDiscount } from '@cart/domain';

// more detail at https://nissorn.notion.site/nissorn-swtest
describe('calculateSubtotal - Weak Normal ECT', () => {
  it.each([
    [[], 0], //TC1
    [[{ price: 450, quantity: 2 }], 900], //TC2
    [[{ price: 450, quantity: 2 }, { price: 1200, quantity: 1 }], 2100], //TC3
  ])('lines %j should return %d', (lines, expected) => {
    expect(calculateSubtotal(lines)).toBe(expected);
  });
});

describe('calculateTotalWeight', () => {
  it.each([
    [[], 0], //TC1
    [[{ weightGram: 300, quantity: 2 }], 600], //TC2
    [[{ weightGram: 300, quantity: 2 }, { weightGram: 900, quantity: 1 }], 1500], //TC3
  ])('lines %j should return %d', (lines, expected) => {
    expect(calculateTotalWeight(lines)).toBe(expected);
  });
});

describe('calculateNetTotal', () => {
  it.each([
    [0, 0, 0, 0], //TC1
    [900, 45, 30, 885], //TC2
  ])('subtotal=%d discount=%d shippingFee=%d should return %d', (subtotal, discount, shippingFee, expected) => {
    expect(calculateNetTotal(subtotal, discount, shippingFee)).toBe(expected);
  });
});

describe('classifyWeight - Normal(+ max+) BV', () => {
  it.each([
    [1, 'light'],
    [2, 'light'],
    [10000, 'heavy'],
    [19999, 'heavy'],
    [20000, 'heavy'],
    [20001, 'overLimit'],
  ])('%d g should be %s', (weight, expected) => {
    expect(classifyWeight(weight)).toBe(expected);
  });
});

describe('calculateDiscount - Decision Table', () => {
  const inactive = { percent: 10, minSpend: 1000, active: false };
  const active = { percent: 10, minSpend: 1000, active: true };

  it.each([
      ['R1', 1000, 'prime',  active,   { discount: 100, source: 'coupon', couponRemoved: false }],
      ['R2', 999,  'prime',  active,   { discount: 49,  source: 'member', couponRemoved: true }],
      ['R3', 999,  'normal', active,   { discount: 0,   source: 'none',   couponRemoved: true }],
      ['R4', 1999, 'prime',  inactive, { discount: 99,  source: 'member', couponRemoved: true }],
      ['R5', 1999, 'normal', inactive, { discount: 0,   source: 'none',   couponRemoved: true }],
      ['R6', 1999, 'prime',  null,     { discount: 99,  source: 'member', couponRemoved: false }],
      ['R7', 1999, 'normal', null,     { discount: 0,   source: 'none',   couponRemoved: false }],
    ] as const)('%s: subtotal=%d tier=%s', (_rule, subtotal, tier, coupon, expected) => {
      expect(calculateDiscount(subtotal, tier, coupon)).toEqual(expected);
    });
});
