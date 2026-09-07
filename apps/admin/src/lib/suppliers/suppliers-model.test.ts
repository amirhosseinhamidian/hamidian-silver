import { describe, expect, it } from 'vitest';

import { parseSupplierCatalog, preferredSupplier } from '@/lib/suppliers/suppliers-model';

const payload = {
  suppliers: [
    {
      id: 'supplier-1',
      code: 'SUP-01',
      name: 'نقره‌سازی پارس',
      contactName: 'علی رضایی',
      phone: '09121234567',
      isActive: true,
      createdAt: '2026-09-07T09:00:00.000Z',
      updatedAt: '2026-09-07T10:00:00.000Z',
    },
  ],
  products: [
    {
      id: 'product-1',
      name: 'انگشتر آذر',
      slug: 'azar-ring',
      status: 'ACTIVE',
      salePriceToman: 1_200_000,
      suppliers: [
        {
          supplierId: 'supplier-1',
          supplierPriceToman: 800_000,
          markupPercent: '25.500',
          isPreferred: true,
          isActive: true,
          updatedAt: '2026-09-07T10:00:00.000Z',
          supplier: {
            id: 'supplier-1',
            code: 'SUP-01',
            name: 'نقره‌سازی پارس',
            isActive: true,
          },
        },
      ],
    },
  ],
};

describe('supplier catalog model', () => {
  it('parses supplier costs, decimal markup and preferred sourcing', () => {
    const catalog = parseSupplierCatalog(payload);
    expect(catalog).not.toBeNull();
    expect(catalog?.products[0]?.suppliers[0]).toEqual(
      expect.objectContaining({
        supplierPriceToman: 800_000,
        markupPercent: 25.5,
        preferred: true,
      }),
    );
    expect(catalog?.products[0] && preferredSupplier(catalog.products[0])?.supplierId).toBe(
      'supplier-1',
    );
  });

  it('rejects incomplete catalog payloads', () => {
    expect(parseSupplierCatalog({ suppliers: [], products: [{ id: 'product-1' }] })).toBeNull();
  });
});
