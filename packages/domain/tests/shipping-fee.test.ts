import { describe, test, expect } from 'vitest';
import { make } from 'covertable';
import { calculateShippingFee } from '@cart/domain';
import type { Zone, Speed, MemberTier } from '@cart/domain';

const factors = {
  weightTier: ['light', 'medium', 'heavy'],
  zone: ['inCity', 'upcountry', 'remote'],
  speed: ['standard', 'express'],
  memberTier: ['normal', 'prime'],
};

const cases = make(factors);
cases.forEach((c, i) => {
  console.log(`TC${i + 1}:`, c.weightTier, c.zone, c.speed, c.memberTier);
});

type TestCase = {
  weightTier: 'light' | 'medium' | 'heavy';
  zone: Zone;
  speed: Speed;
  memberTier: MemberTier;
  expected: number;
};

const testCases: TestCase[] = [
  { weightTier: 'medium', zone: 'inCity',    speed: 'express',  memberTier: 'normal', expected: 75 },
  { weightTier: 'light',  zone: 'remote',    speed: 'standard', memberTier: 'prime',  expected: 0 },
  { weightTier: 'heavy',  zone: 'upcountry', speed: 'express',  memberTier: 'prime',  expected: 60 },
  { weightTier: 'light',  zone: 'upcountry', speed: 'standard', memberTier: 'normal', expected: 50 },
  { weightTier: 'heavy',  zone: 'remote',    speed: 'express',  memberTier: 'normal', expected: 270 },
  { weightTier: 'light',  zone: 'inCity',    speed: 'express',  memberTier: 'prime',  expected: 15 },
  { weightTier: 'medium', zone: 'inCity',    speed: 'standard', memberTier: 'prime',  expected: 0 },
  { weightTier: 'heavy',  zone: 'inCity',    speed: 'standard', memberTier: 'normal', expected: 80 },
  { weightTier: 'medium', zone: 'upcountry', speed: 'standard', memberTier: 'normal', expected: 80 },
  { weightTier: 'medium', zone: 'remote',    speed: 'standard', memberTier: 'normal', expected: 120 },
];

// Notion: https://app.notion.com/p/Order-40d51d114daf80f48d71e5e7fc2f249e?source=copy_link#40d51d114daf8050a333faec07aef4e7
describe('calculateShippingFee - Pairwise', () => {
  test.each(testCases)(
    'fee($weightTier, $zone, $speed, $memberTier) = $expected',
    ({ weightTier, zone, speed, memberTier, expected }) => {
      const actual = calculateShippingFee(weightTier, zone, speed, memberTier);
      expect(actual).toBe(expected);
    },
  );
});
