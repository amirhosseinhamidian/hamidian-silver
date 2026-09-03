import { BadRequestException } from '@nestjs/common';

import { TOMAN_INT_MAX } from './toman';

export function calculatePlatingPriceToman(weightGrams: string, pricePerGramToman: number): number {
  const [wholePart, fractionPart = ''] = weightGrams.split('.');
  const normalizedFraction = fractionPart.padEnd(3, '0').slice(0, 3);
  const milliGrams = BigInt(wholePart) * 1000n + BigInt(normalizedFraction || '0');

  if (
    milliGrams < 0n ||
    !Number.isInteger(pricePerGramToman) ||
    pricePerGramToman < 0 ||
    pricePerGramToman > TOMAN_INT_MAX
  ) {
    throw new BadRequestException('Calculated plating price exceeds the supported range.');
  }

  const totalMilliToman = milliGrams * BigInt(pricePerGramToman);
  const roundedToman = (totalMilliToman + 500n) / 1000n;

  if (roundedToman > BigInt(TOMAN_INT_MAX)) {
    throw new BadRequestException('Calculated plating price exceeds the supported range.');
  }

  return Number(roundedToman);
}
