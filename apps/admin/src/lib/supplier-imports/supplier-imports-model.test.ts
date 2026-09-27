import { describe, expect, it } from 'vitest';

import {
  parseSupplierImportDrafts,
  parseSupplierImportSources,
} from '@/lib/supplier-imports/supplier-imports-model';

describe('supplier imports model', () => {
  it('marks the BSJ adapter as supported and parses the latest run', () => {
    expect(
      parseSupplierImportSources([
        {
          id: 'source-1',
          name: 'سایت اصلی',
          baseUrl: 'https://bsjsilver.com/',
          hostname: 'bsjsilver.com',
          adapterKey: 'bsj-silver',
          supplier: { name: 'بی‌اس‌جی', code: 'BSJ' },
          crawlRuns: [{ status: 'SUCCEEDED', createdAt: '2026-09-27T10:00:00.000Z' }],
        },
      ])?.[0],
    ).toEqual(
      expect.objectContaining({
        supported: true,
        supplierName: 'بی‌اس‌جی',
        lastRunStatus: 'SUCCEEDED',
      }),
    );
  });

  it('parses a review draft without treating supplier retail price as a sale price', () => {
    expect(
      parseSupplierImportDrafts([
        {
          id: 'draft-1',
          sourceProductKey: '10611820',
          sourceUrl: 'https://bsjsilver.com/product/10611820-item',
          sourceSku: '10611820',
          title: 'دستبند نقره',
          description: null,
          sourceCategory: 'دستبند',
          supplierRetailPriceToman: 24_638_000,
          weightGrams: '13.780',
          attributes: [{ key: 'نوع آبکاری', value: 'رادیوم' }],
          imageUrls: ['https://bsjsilver.com/images/item.jpg'],
          status: 'PENDING_REVIEW',
          lastCrawledAt: '2026-09-27T10:00:00.000Z',
          updatedAt: '2026-09-27T10:00:00.000Z',
          supplierSource: {
            id: 'source-1',
            name: 'سایت اصلی',
            hostname: 'bsjsilver.com',
            supplier: { name: 'بی‌اس‌جی', code: 'BSJ' },
          },
          reviewedBy: null,
        },
      ])?.[0],
    ).toEqual(
      expect.objectContaining({
        supplierRetailPriceToman: 24_638_000,
        weightGrams: 13.78,
        status: 'PENDING_REVIEW',
      }),
    );
  });

  it('rejects malformed draft records', () => {
    expect(parseSupplierImportDrafts([{ id: 'draft-1' }])).toBeNull();
  });
});
