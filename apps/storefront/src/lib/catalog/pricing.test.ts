import { describe, expect, it } from 'vitest';

import { getDiscountPercent, getPriceDiscount } from '@/lib/catalog/pricing';

describe('catalog pricing', () => {
  it('calculates and rounds the product discount percentage', () => {
    expect(getDiscountPercent(1_000_000, 700_000)).toBe(30);
    expect(getDiscountPercent(1_000_000, 666_667)).toBe(33);
  });

  it.each([
    [null, 700_000],
    [undefined, 700_000],
    [1_000_000, null],
    [1_000_000, undefined],
    [Number.NaN, 700_000],
    [1_000_000, Number.POSITIVE_INFINITY],
    [0, 0],
    [-1, 0],
    [1_000_000, 1_000_000],
    [900_000, 1_000_000],
  ])('returns no discount for compare price %s and sale price %s', (compareAt, sale) => {
    expect(getDiscountPercent(compareAt, sale)).toBeNull();
    expect(getPriceDiscount(compareAt, sale)).toEqual({
      hasDiscount: false,
      discountPercent: null,
    });
  });
});
