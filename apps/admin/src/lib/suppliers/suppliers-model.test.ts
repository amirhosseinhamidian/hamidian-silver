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
      sources: [
        {
          id: 'source-1',
          name: 'فروشگاه اصلی',
          baseUrl: 'https://supplier.example.com/',
          hostname: 'supplier.example.com',
          crawlerType: 'CUSTOM_ADAPTER',
          adapterKey: 'supplier-main',
          crawlDelayMs: 2500,
          maxConcurrency: 1,
          isActive: true,
          createdAt: '2026-09-07T09:00:00.000Z',
          updatedAt: '2026-09-07T10:00:00.000Z',
          crawlRuns: [
            {
              id: 'run-1',
              status: 'SUCCEEDED',
              discoveredCount: 12,
              succeededCount: 12,
              failedCount: 0,
              errorMessage: null,
              startedAt: '2026-09-07T09:30:00.000Z',
              finishedAt: '2026-09-07T09:31:00.000Z',
              createdAt: '2026-09-07T09:30:00.000Z',
            },
          ],
        },
      ],
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
    expect(catalog?.suppliers[0]?.sources[0]).toEqual(
      expect.objectContaining({
        hostname: 'supplier.example.com',
        crawlerType: 'CUSTOM_ADAPTER',
        crawlDelayMs: 2500,
        lastRun: expect.objectContaining({ status: 'SUCCEEDED', discoveredCount: 12 }),
      }),
    );
  });

  it('rejects incomplete catalog payloads', () => {
    expect(parseSupplierCatalog({ suppliers: [], products: [{ id: 'product-1' }] })).toBeNull();
  });
});
