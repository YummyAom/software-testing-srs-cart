import { describe, it, expect } from 'vitest';
import { isProductAvailable } from '@cart/domain';

describe('isProductAvailable - Decision Table + Robust BVA', () => {
  it.each([
    ['UT-AVAIL-01', true, 0, false, 'DT / BVA min-1: isOnSale true, availableStock 0 (AC-11b, AC-11c)'],
    ['UT-AVAIL-02', true, 1, true, 'DT / BVA min: isOnSale true, availableStock 1 (SRS §2)'],
    ['UT-AVAIL-03', true, 2, true, 'BVA min+1: isOnSale true, availableStock 2 (SRS §2)'],
    ['UT-AVAIL-04', false, 0, false, 'DT: isOnSale false, availableStock 0 (SRS §2)'],
    ['UT-AVAIL-05', false, 20, false, 'DT: isOnSale false, availableStock 20 (AC-10)'],
  ])('%s: isOnSale=%s, availableStock=%d => %s (%s)', (_id, isOnSale, availableStock, expected) => {
    expect(isProductAvailable(isOnSale, availableStock)).toBe(expected);
  });
});

