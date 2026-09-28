import { describe, expect, it } from 'vitest';

import {
  buildSupplierImportsHref,
  parseSupplierImportDraftPage,
  parseSupplierImportFilters,
  parseSupplierImportDrafts,
  parseSupplierImportSources,
  parseSupplierCrawlRuns,
  parseSupplierCrawlRunPage,
  parseSupplierCrawlSchedules,
  parseSupplierSourceCategories,
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

  it('parses the catalog product linked to an imported draft', () => {
    const parsed = parseSupplierImportDrafts([
      {
        id: 'draft-1',
        sourceProductKey: '10611820',
        sourceUrl: 'https://bsjsilver.com/product/10611820-item',
        title: 'دستبند نقره',
        attributes: [],
        imageUrls: [],
        status: 'IMPORTED',
        importedAt: '2026-09-28T06:30:00.000Z',
        lastCrawledAt: '2026-09-28T06:00:00.000Z',
        updatedAt: '2026-09-28T06:30:00.000Z',
        supplierSource: {
          id: 'source-1',
          name: 'سایت اصلی',
          hostname: 'bsjsilver.com',
          supplier: { name: 'بی‌اس‌جی', code: 'BSJ' },
        },
        product: {
          id: 'product-1',
          name: 'دستبند نقره',
          slug: 'silver-bracelet',
          status: 'DRAFT',
        },
      },
    ])?.[0];

    expect(parsed).toEqual(
      expect.objectContaining({
        status: 'IMPORTED',
        importedAt: '2026-09-28T06:30:00.000Z',
        product: expect.objectContaining({ id: 'product-1', slug: 'silver-bracelet' }),
      }),
    );
  });

  it('parses supplier categories and bulk crawl progress', () => {
    expect(
      parseSupplierSourceCategories([
        {
          id: 'category-1',
          supplierSourceId: 'source-1',
          externalKey: '12',
          name: 'دستبند',
          url: 'https://bsjsilver.com/product/category/12-bracelet',
        },
      ]),
    ).toHaveLength(1);
    expect(
      parseSupplierCrawlRuns([
        {
          id: 'run-1',
          supplierSourceId: 'source-1',
          scope: 'SCHEDULED',
          status: 'RUNNING',
          requestedLimit: 100,
          currentPage: 2,
          discoveredCount: 20,
          succeededCount: 12,
          failedCount: 1,
          skippedCount: 7,
          stopAtKnown: false,
          createdAt: '2026-09-27T10:00:00.000Z',
          supplierSource: { name: 'سایت اصلی', supplier: { name: 'بی‌اس‌جی' } },
          category: { name: 'دستبند' },
          schedule: { categoryIds: ['category-1'] },
        },
      ])?.[0],
    ).toEqual(
      expect.objectContaining({
        status: 'RUNNING',
        succeededCount: 12,
        isScheduled: true,
        scheduledCategoryIds: ['category-1'],
      }),
    );
  });

  it('parses server-side draft and crawl history pages', () => {
    const draftPayload = {
      items: [
        {
          id: 'draft-1',
          sourceProductKey: '10611820',
          sourceUrl: 'https://bsjsilver.com/product/10611820-item',
          title: 'دستبند نقره',
          attributes: [],
          imageUrls: [],
          status: 'PENDING_REVIEW',
          lastCrawledAt: '2026-09-27T10:00:00.000Z',
          updatedAt: '2026-09-27T10:00:00.000Z',
          supplierSource: {
            id: 'source-1',
            name: 'سایت اصلی',
            hostname: 'bsjsilver.com',
            supplier: { name: 'بی‌اس‌جی', code: 'BSJ' },
          },
        },
      ],
      total: 30,
      page: 2,
      pageSize: 12,
      totalPages: 3,
    };
    expect(parseSupplierImportDraftPage(draftPayload)).toEqual(
      expect.objectContaining({ total: 30, page: 2, pageSize: 12 }),
    );

    expect(
      parseSupplierCrawlRunPage({
        items: [],
        total: 0,
        page: 1,
        pageSize: 10,
        totalPages: 1,
      }),
    ).toEqual({ items: [], total: 0, page: 1, pageSize: 10, totalPages: 1 });
  });

  it('normalizes import filters and preserves them in pagination links', () => {
    const filters = parseSupplierImportFilters({
      status: 'REVIEWED',
      page: '3',
      pageSize: '48',
      crawlView: 'history',
      historyPage: '2',
      historyPageSize: '25',
    });
    expect(filters).toEqual(
      expect.objectContaining({
        status: 'REVIEWED',
        page: 3,
        pageSize: 48,
        showHistory: true,
        historyPage: 2,
      }),
    );
    expect(buildSupplierImportsHref(filters, { page: 4 })).toContain('page=4');
    expect(buildSupplierImportsHref(filters, { page: 4 })).toContain('crawlView=history');
  });

  it('parses crawl schedules and their latest run', () => {
    expect(
      parseSupplierCrawlSchedules([
        {
          id: 'schedule-1',
          supplierSourceId: 'source-1',
          categoryIds: ['category-1'],
          isEnabled: true,
          timeOfDay: '02:00',
          timezone: 'Asia/Tehran',
          requestedLimit: 100,
          stopAtKnown: true,
          maxRetries: 2,
          retryDelayMinutes: 15,
          nextRunAt: '2026-09-29T22:30:00.000Z',
          crawlRuns: [
            {
              id: 'run-1',
              status: 'SUCCEEDED',
              createdAt: '2026-09-28T22:30:00.000Z',
              finishedAt: '2026-09-28T22:40:00.000Z',
            },
          ],
        },
      ])?.[0],
    ).toEqual(
      expect.objectContaining({
        supplierSourceId: 'source-1',
        isEnabled: true,
        categoryIds: ['category-1'],
        lastRun: expect.objectContaining({ status: 'SUCCEEDED' }),
      }),
    );
  });
});
