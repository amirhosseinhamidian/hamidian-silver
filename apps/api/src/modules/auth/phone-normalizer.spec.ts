import { BadRequestException } from '@nestjs/common';
import { normalizeIranianMobile } from './phone-normalizer';

describe('normalizeIranianMobile', () => {
  it.each([
    ['09123456789', '+989123456789'],
    ['9123456789', '+989123456789'],
    ['+989123456789', '+989123456789'],
    ['989123456789', '+989123456789'],
    ['00989123456789', '+989123456789'],
    ['۰۹۱۲۳۴۵۶۷۸۹', '+989123456789'],
    ['٠٩١٢٣٤٥٦٧٨٩', '+989123456789'],
    ['0912 345 6789', '+989123456789'],
  ])('normalizes %s', (input, expected) => {
    expect(normalizeIranianMobile(input)).toBe(expected);
  });

  it.each(['', '123', '+981234567890', '0912345678a'])('rejects invalid input %s', (input) => {
    expect(() => normalizeIranianMobile(input)).toThrow(BadRequestException);
  });
});
