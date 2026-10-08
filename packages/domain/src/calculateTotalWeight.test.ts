import { expect, it } from 'vitest';
import { calculateTotalWeight } from './index.js';

// SRS §2 total-weight definition, §7 seed weights; AC-4/6/8/9.
it.each([
  { lines: [], expected: 0 },
  { lines: [{ weightGram: 300, quantity: 1 }, { weightGram: 900, quantity: 1 }], expected: 1200 },
  { lines: [{ weightGram: 300, quantity: 2 }], expected: 600 },
  { lines: [{ weightGram: 8000, quantity: 1 }], expected: 8000 },
  { lines: [{ weightGram: 8000, quantity: 3 }], expected: 24000 },
])('calculateTotalWeight — SRS §2: $lines => $expected grams', ({ lines, expected }) => {
  expect(calculateTotalWeight(lines)).toBe(expected);
});
