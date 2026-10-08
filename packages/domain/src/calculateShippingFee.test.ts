import { expect, it } from 'vitest';
import { calculateShippingFee } from './index.js';

// FR-4.6/4.7: independent literal THB oracle for all 36 combinations.
// Columns: normal standard, normal express, prime standard, prime express.
const rates = [
  ['light', 'inCity', 30, 45, 0, 15],
  ['light', 'upcountry', 50, 75, 0, 25],
  ['light', 'remote', 80, 120, 0, 40],
  ['medium', 'inCity', 50, 75, 0, 25],
  ['medium', 'upcountry', 80, 120, 0, 40],
  ['medium', 'remote', 120, 180, 0, 60],
  ['heavy', 'inCity', 80, 120, 0, 40],
  ['heavy', 'upcountry', 120, 180, 0, 60],
  ['heavy', 'remote', 180, 270, 0, 90],
] as const;

const cases = rates.flatMap(([weightTier, zone, normalStandard, normalExpress, primeStandard, primeExpress]) => [
  { weightTier, zone, memberTier: 'normal' as const, speed: 'standard' as const, expected: normalStandard },
  { weightTier, zone, memberTier: 'normal' as const, speed: 'express' as const, expected: normalExpress },
  { weightTier, zone, memberTier: 'prime' as const, speed: 'standard' as const, expected: primeStandard },
  { weightTier, zone, memberTier: 'prime' as const, speed: 'express' as const, expected: primeExpress },
]);

it.each(cases)('calculateShippingFee — FR-4.6/4.7: $weightTier/$zone/$memberTier/$speed => $expected',
  ({ weightTier, zone, memberTier, speed, expected }) => {
    expect(calculateShippingFee(weightTier, zone, speed, memberTier)).toBe(expected);
  },
);
