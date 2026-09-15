import { BadRequestException } from '@nestjs/common';

import { calculatePlatingPriceToman } from './plating-price';

describe('calculatePlatingPriceToman', () => {
  it('calculates a rounded unit plating price from a three-decimal gram weight', () => {
    expect(calculatePlatingPriceToman('4.250', 5_000)).toBe(21_250);
    expect(calculatePlatingPriceToman('1.111', 1_500)).toBe(1_667);
  });

  it('rejects negative plating inputs before rounding', () => {
    expect(() => calculatePlatingPriceToman('1.000', -1)).toThrow(BadRequestException);
    expect(() => calculatePlatingPriceToman('-1.000', 1)).toThrow(BadRequestException);
  });
});
