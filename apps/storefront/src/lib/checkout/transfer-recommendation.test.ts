import { describe, expect, it } from 'vitest';

import {
  banksMatch,
  recommendTransfer,
  TRANSFER_LIMITS_TOMAN,
} from '@/lib/checkout/transfer-recommendation';

describe('transfer recommendation', () => {
  it.each([
    [TRANSFER_LIMITS_TOMAN.cardToCard, 'CARD_TO_CARD'],
    [TRANSFER_LIMITS_TOMAN.cardToCard + 1, 'POL'],
    [TRANSFER_LIMITS_TOMAN.pol, 'POL'],
    [TRANSFER_LIMITS_TOMAN.pol + 1, 'SATNA'],
    [TRANSFER_LIMITS_TOMAN.payaPerInstruction + 1, 'SATNA_OR_ACCOUNT'],
  ] as const)('selects the network method for %i toman', (amountToman, method) => {
    expect(recommendTransfer(amountToman, '', 'بانک ملی ایران').method).toBe(method);
  });

  it('prioritizes an intra-bank transfer and keeps the amount-based fallback', () => {
    const recommendation = recommendTransfer(38_000_000, 'بانک ملت', 'ملت');

    expect(recommendation.method).toBe('INTRA_BANK');
    expect(recommendation.alternative).toContain('پل');
  });

  it('normalizes common bank-name variants without fuzzy matching unrelated banks', () => {
    expect(banksMatch('بانک ملی ایران', 'ملی')).toBe(true);
    expect(banksMatch('پست بانک ایران', 'پست بانک')).toBe(true);
    expect(banksMatch('بانک ملت', 'بانک ملی')).toBe(false);
  });
});
