import { describe, expect, it } from 'vitest';

import {
  parsePricingCatalog,
  productDiscountPercent,
  productGrossMargin,
} from '@/lib/pricing/pricing-model';

const payload = {
  products: [
    {
      id: 'product-1',
      name: 'انگشتر آذر',
      slug: 'azar-ring',
      status: 'ACTIVE',
      salePriceToman: 1_200_000,
      compareAtPriceToman: 1_500_000,
      suppliers: [
        {
          supplierPriceToman: 800_000,
          supplier: { id: 'supplier-1', code: 'SUP-1', name: 'نقره‌سازی پارس' },
        },
      ],
    },
  ],
  platingRates: [
    {
      id: 'rate-1',
      type: 'GOLD',
      pricePerGramToman: 250_000,
      leadTimeDays: 3,
      isActive: true,
      updatedAt: '2026-09-07T12:00:00.000Z',
    },
  ],
  productHistory: [
    {
      id: 'history-product',
      previousPriceToman: 1_100_000,
      newPriceToman: 1_200_000,
      previousCompareAtPriceToman: null,
      newCompareAtPriceToman: 1_500_000,
      reason: 'به‌روزرسانی دوره‌ای',
      createdAt: '2026-09-07T12:00:00.000Z',
      product: { id: 'product-1', name: 'انگشتر آذر', slug: 'azar-ring' },
      changedBy: { firstName: 'مدیر', lastName: 'فروش' },
    },
  ],
  platingHistory: [
    {
      id: 'history-plating',
      previousPricePerGramToman: 220_000,
      newPricePerGramToman: 250_000,
      previousLeadTimeDays: 2,
      newLeadTimeDays: 3,
      createdAt: '2026-09-07T11:00:00.000Z',
      platingRate: { id: 'rate-1', type: 'GOLD' },
      changedBy: null,
    },
  ],
};

describe('pricing catalog model', () => {
  it('parses pricing metrics and combines history chronologically', () => {
    const catalog = parsePricingCatalog(payload);
    expect(catalog).not.toBeNull();
    expect(catalog?.products[0]).toEqual(
      expect.objectContaining({ supplierCostToman: 800_000, supplierName: 'نقره‌سازی پارس' }),
    );
    expect(catalog?.history.map((item) => item.id)).toEqual(['history-product', 'history-plating']);
    expect(catalog?.history[0]?.actor).toBe('مدیر فروش');
  });

  it('calculates gross margin and discount percentage', () => {
    const product = parsePricingCatalog(payload)?.products[0];
    expect(product && productGrossMargin(product)).toBe(400_000);
    expect(product && productDiscountPercent(product)).toBe(20);
  });

  it('rejects an incomplete pricing catalog', () => {
    expect(
      parsePricingCatalog({
        products: [{ id: 'product-1' }],
        platingRates: [],
        productHistory: [],
        platingHistory: [],
      }),
    ).toBeNull();
  });
});
