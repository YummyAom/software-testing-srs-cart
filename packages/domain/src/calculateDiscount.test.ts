import { describe, expect, it } from 'vitest';
import { calculateDiscount } from './index.js';

// FR-4.4; decision-table R1/R2. AC-5: prime subtotal 1650 => 82, not 83.
describe('calculateDiscount — SRS DC-1', () => {
  it.each([
    ['normal', 0, 0, 'none'], ['prime', 0, 0, 'member'],
    ['normal', 999, 0, 'none'], ['prime', 999, 49, 'member'],
    ['normal', 1000, 0, 'none'], ['prime', 1000, 50, 'member'],
    ['normal', 1001, 0, 'none'], ['prime', 1001, 50, 'member'],
    ['normal', 1650, 0, 'none'], ['prime', 1650, 82, 'member'],
  ] as const)('no coupon: %s subtotal %s => %s from %s', (tier, subtotal, discount, source) => {
    expect(calculateDiscount(subtotal, tier, null)).toEqual({ discount, source, couponRemoved: false });
  });

  // FR-4.2; R7: inclusive minimum, floor, coupon only even when member discount is greater.
  it.each([
    [1000, 10, 100], [1001, 10, 100], [1650, 10, 165],
    [1650, 15, 247], [1650, 1, 16],
  ] as const)('eligible coupon: subtotal=%s percent=%s => %s, no stacking', (subtotal, percent, discount) => {
    for (const tier of ['normal', 'prime'] as const) {
      expect(calculateDiscount(subtotal, tier, { percent, minSpend: 1000, active: true }))
        .toEqual({ discount, source: 'coupon', couponRemoved: false });
    }
  });

  // FR-4.3/4.4; R3–R6: inactive OR below minimum removes coupon, then member fallback.
  it.each([
    ['normal', 999, false, 0, 'none'], ['prime', 999, false, 49, 'member'],
    ['normal', 1000, false, 0, 'none'], ['prime', 1000, false, 50, 'member'],
    ['normal', 999, true, 0, 'none'], ['prime', 999, true, 49, 'member'],
    ['normal', 900, true, 0, 'none'], ['prime', 900, true, 45, 'member'],
  ] as const)('attached coupon: %s subtotal=%s active=%s => removed, %s from %s', (tier, subtotal, active, discount, source) => {
    const coupon = { percent: 10, minSpend: 1000, active };
    expect(calculateDiscount(subtotal, tier, coupon)).toEqual({ discount, source, couponRemoved: true });
    expect(coupon).toEqual({ percent: 10, minSpend: 1000, active });
  });

  // FR-4.2–4.4: expansion of all 16 attached × active × threshold × member assignments.
  // active/minimum are don't-care when detached; the supplied coupon is then null.
  it.each([
    [false, false, 999, 'normal', 0, 'none', false],
    [false, false, 999, 'prime', 49, 'member', false],
    [false, false, 1000, 'normal', 0, 'none', false],
    [false, false, 1000, 'prime', 50, 'member', false],
    [false, true, 999, 'normal', 0, 'none', false],
    [false, true, 999, 'prime', 49, 'member', false],
    [false, true, 1000, 'normal', 0, 'none', false],
    [false, true, 1000, 'prime', 50, 'member', false],
    [true, false, 999, 'normal', 0, 'none', true],
    [true, false, 999, 'prime', 49, 'member', true],
    [true, false, 1000, 'normal', 0, 'none', true],
    [true, false, 1000, 'prime', 50, 'member', true],
    [true, true, 999, 'normal', 0, 'none', true],
    [true, true, 999, 'prime', 49, 'member', true],
    [true, true, 1000, 'normal', 100, 'coupon', false],
    [true, true, 1000, 'prime', 100, 'coupon', false],
  ] as const)('decision expansion: attached=%s active=%s subtotal=%s tier=%s => %s/%s removed=%s',
    (attached, active, subtotal, tier, discount, source, couponRemoved) => {
      const coupon = attached ? { percent: 10, minSpend: 1000, active } : null;
      expect(calculateDiscount(subtotal, tier, coupon)).toEqual({ discount, source, couponRemoved });
    },
  );
});
