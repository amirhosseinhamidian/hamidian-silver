import { describe, expect, it } from 'vitest';

import {
  parsePlatingRates,
  parsePlatingVariants,
  platingTypeLabel,
} from '@/lib/plating/plating-model';

describe('plating model', () => {
  it('parses rates and rejects unsupported plating types', () => {
    expect(
      parsePlatingRates([
        {
          id: 'rate-1',
          type: 'GOLD',
          pricePerGramToman: 50_000,
          leadTimeDays: 3,
          isActive: true,
          createdAt: '2026-09-07T10:00:00.000Z',
          updatedAt: '2026-09-07T11:00:00.000Z',
        },
      ]),
    ).toEqual([expect.objectContaining({ type: 'GOLD', pricePerGramToman: 50_000, active: true })]);
    expect(
      parsePlatingRates([
        {
          id: 'rate-2',
          type: 'SILVER',
          pricePerGramToman: 1,
          leadTimeDays: 1,
          createdAt: '2026-09-07T10:00:00.000Z',
          updatedAt: '2026-09-07T11:00:00.000Z',
        },
      ]),
    ).toBeNull();
  });

  it('parses decimal weights and complete option state', () => {
    expect(
      parsePlatingVariants([
        {
          id: 'variant-1',
          sku: 'RING-52',
          name: 'سایز ۵۲',
          weightGrams: '4.250',
          isActive: true,
          platingEligible: true,
          product: {
            id: 'product-1',
            name: 'انگشتر آذر',
            slug: 'azar-ring',
            status: 'ACTIVE',
          },
          size: { id: 'size-1', label: '۵۲' },
          platingOptions: [
            {
              isActive: true,
              platingRate: {
                type: 'GOLD',
                pricePerGramToman: 50_000,
                leadTimeDays: 3,
                isActive: true,
              },
            },
          ],
        },
      ]),
    ).toEqual([
      expect.objectContaining({
        id: 'variant-1',
        productName: 'انگشتر آذر',
        weightGrams: 4.25,
        eligible: true,
        options: [expect.objectContaining({ type: 'GOLD', active: true })],
      }),
    ]);
    expect(platingTypeLabel('RHODIUM')).toBe('آبکاری رودیوم');
  });
});
