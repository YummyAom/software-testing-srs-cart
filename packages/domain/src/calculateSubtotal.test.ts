import { expect, it } from 'vitest';
import { calculateSubtotal } from './index.js';

// FR-4.1; seed prices in SRS §7, AC-4/6/8. Literal THB totals, not production arithmetic.
it.each([
  { lines: [], expected: 0 },
  { lines: [{ price: 450, quantity: 1 }, { price: 1200, quantity: 1 }], expected: 1650 },
  { lines: [{ price: 450, quantity: 2 }], expected: 900 },
  { lines: [{ price: 15000, quantity: 1 }], expected: 15000 },
  { lines: [{ price: 50000, quantity: 10 }, { price: 1, quantity: 10 }], expected: 500010 },
])('calculateSubtotal — FR-4.1: $lines => $expected', ({ lines, expected }) => {
  expect(calculateSubtotal(lines)).toBe(expected);
});
