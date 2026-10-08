import { expect, it } from 'vitest';
import { calculateNetTotal } from './index.js';

// FR-4.8; independent literal SRS acceptance totals AC-4/5/6/7/8.
it.each([
  [1650, 165, 0, 1485], [1650, 82, 0, 1568],
  [900, 45, 25, 880], [1200, 0, 30, 1230], [15000, 0, 270, 15270],
  [0, 0, 0, 0],
] as const)('calculateNetTotal — FR-4.8: subtotal=%s discount=%s shipping=%s => %s', (subtotal, discount, shippingFee, expected) => {
  expect(calculateNetTotal(subtotal, discount, shippingFee)).toBe(expected);
});
