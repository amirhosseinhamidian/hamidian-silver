import { BadRequestException } from '@nestjs/common';

import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { BsjSilverCrawlerAdapter } from './adapters/bsj-silver-crawler.adapter';
import { SupplierImportsService } from './supplier-imports.service';

describe('SupplierImportsService', () => {
  const sourceId = '10000000-0000-4000-8000-000000000001';
  const runId = '10000000-0000-4000-8000-000000000002';
  const draft = { id: '10000000-0000-4000-8000-000000000003' };
  const prisma = {
    supplierSource: { findFirst: jest.fn() },
    supplierSourceCategory: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      upsert: jest.fn(),
    },
    category: { findFirst: jest.fn() },
    supplierProductSourceChange: {
      count: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    supplierCrawlIssue: { create: jest.fn() },
    supplierCrawlRun: {
      count: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    supplierCrawlSchedule: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    supplierProductImportDraft: {
      count: jest.fn(),
      upsert: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const service = new SupplierImportsService(
    prisma as unknown as PrismaService,
    new BsjSilverCrawlerAdapter(),
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.supplierSource.findFirst.mockResolvedValue({
      id: sourceId,
      hostname: 'bsjsilver.com',
      adapterKey: 'bsj-silver',
    });
    prisma.supplierCrawlRun.findFirst.mockResolvedValue(null);
    prisma.supplierCrawlRun.create.mockResolvedValue({ id: runId });
    prisma.supplierCrawlRun.update.mockResolvedValue({ id: runId });
    prisma.supplierCrawlRun.updateMany.mockResolvedValue({ count: 1 });
    prisma.supplierCrawlSchedule.upsert.mockResolvedValue({ id: 'schedule-1' });
    prisma.supplierCrawlSchedule.update.mockResolvedValue({ id: 'schedule-1' });
    prisma.supplierCrawlSchedule.updateMany.mockResolvedValue({ count: 1 });
    prisma.supplierProductImportDraft.upsert.mockResolvedValue(draft);
    prisma.supplierProductSourceChange.create.mockResolvedValue({ id: 'change-1' });
    prisma.$transaction.mockImplementation(
      (operation: ((transaction: typeof prisma) => unknown) | readonly unknown[]) =>
        Array.isArray(operation) ? Promise.all(operation) : operation(prisma),
    );
  });

  afterEach(() => jest.restoreAllMocks());

  it('rejects URLs outside the exact configured supplier hostname before fetching', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch');

    await expect(
      service.crawlProduct({
        supplierSourceId: sourceId,
        targetUrl: 'https://attacker.example/product/10611820-item',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(prisma.supplierCrawlRun.create).not.toHaveBeenCalled();
  });

  it('stores one review draft and completes its crawl run', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        `
          <script type="application/ld+json">
            {"@type":"Product","name":"دستبند نقره","sku":"10611820","price":"12000000","priceCurrency":"IRR"}
          </script>
          <div id="frmSecProductMain"><h1>دستبند نقره</h1></div>
        `,
        { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
      ),
    );

    await expect(
      service.crawlProduct({
        supplierSourceId: sourceId,
        targetUrl: 'https://bsjsilver.com/product/10611820-item',
      }),
    ).resolves.toEqual({ runId, draft });
    expect(prisma.supplierProductImportDraft.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          sourceProductKey: '10611820',
          supplierRetailPriceToman: 1_200_000,
          status: 'PENDING_REVIEW',
        }),
      }),
    );
    expect(prisma.supplierCrawlRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: runId },
        data: expect.objectContaining({ status: 'SUCCEEDED', succeededCount: 1 }),
      }),
    );
  });

  it('queues a category crawl with a new-product limit', async () => {
    prisma.supplierSource.findFirst.mockResolvedValue({
      id: sourceId,
      hostname: 'bsjsilver.com',
      adapterKey: 'bsj-silver',
      baseUrl: 'https://bsjsilver.com/',
      crawlDelayMs: 1000,
    });
    prisma.supplierSourceCategory.findFirst.mockResolvedValue({
      id: '10000000-0000-4000-8000-000000000004',
      url: 'https://bsjsilver.com/product/category/12-bracelet',
    });
    prisma.supplierCrawlRun.create.mockResolvedValue({ id: runId, status: 'QUEUED' });

    await expect(
      service.startBulkCrawl({
        supplierSourceId: sourceId,
        categoryId: '10000000-0000-4000-8000-000000000004',
        limit: 100,
        stopAtKnown: true,
        monitorKnownProducts: true,
      }),
    ).resolves.toEqual({ id: runId, status: 'QUEUED' });
    expect(prisma.supplierCrawlRun.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        scope: 'CATEGORY_URL',
        requestedLimit: 100,
        stopAtKnown: true,
        monitorKnownProducts: true,
      }),
    });
  });

  it('stores a daily Tehran schedule with retry policy', async () => {
    prisma.supplierSourceCategory.findMany.mockResolvedValue([]);

    await expect(
      service.updateSchedule(sourceId, {
        isEnabled: true,
        timeOfDay: '02:30',
        categoryIds: [],
        requestedLimit: 150,
        stopAtKnown: true,
        monitorKnownProducts: true,
        maxRetries: 3,
        retryDelayMinutes: 20,
      }),
    ).resolves.toEqual({ id: 'schedule-1' });

    expect(prisma.supplierCrawlSchedule.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { supplierSourceId: sourceId },
        create: expect.objectContaining({
          timezone: 'Asia/Tehran',
          requestedLimit: 150,
          maxRetries: 3,
          nextRunAt: expect.any(Date),
        }),
      }),
    );
  });

  it('queues an immediate scheduled crawl with its configured categories', async () => {
    const categoryId = '10000000-0000-4000-8000-000000000004';
    prisma.supplierCrawlSchedule.findUnique.mockResolvedValue({
      id: 'schedule-1',
      supplierSourceId: sourceId,
      categoryIds: [categoryId],
      requestedLimit: 200,
      stopAtKnown: true,
      monitorKnownProducts: true,
      maxRetries: 2,
      retryDelayMinutes: 15,
      supplierSource: {},
    });
    prisma.supplierSource.findFirst.mockResolvedValue({
      id: sourceId,
      hostname: 'bsjsilver.com',
      adapterKey: 'bsj-silver',
      baseUrl: 'https://bsjsilver.com/',
      crawlDelayMs: 1000,
    });
    prisma.supplierSourceCategory.findMany.mockResolvedValue([
      {
        id: categoryId,
        name: 'دستبند',
        url: 'https://bsjsilver.com/product/category/12-bracelet',
      },
    ]);
    prisma.supplierCrawlRun.create.mockResolvedValue({ id: runId, status: 'QUEUED' });

    await expect(service.runScheduleNow(sourceId)).resolves.toEqual({
      id: runId,
      status: 'QUEUED',
    });
    expect(prisma.supplierCrawlRun.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        scheduleId: 'schedule-1',
        categoryId,
        scope: 'SCHEDULED',
        requestedLimit: 200,
        maxRetries: 2,
      }),
    });
  });

  it('leases a due schedule and advances it atomically with the queued run', async () => {
    prisma.supplierCrawlSchedule.findMany.mockResolvedValue([
      {
        id: 'schedule-1',
        supplierSourceId: sourceId,
        categoryIds: [],
        isEnabled: true,
        timeOfDay: '02:00',
        timezone: 'Asia/Tehran',
        requestedLimit: 100,
        stopAtKnown: true,
        monitorKnownProducts: true,
        maxRetries: 2,
        retryDelayMinutes: 15,
        supplierSource: {},
      },
    ]);
    prisma.supplierSource.findFirst.mockResolvedValue({
      id: sourceId,
      hostname: 'bsjsilver.com',
      adapterKey: 'bsj-silver',
      baseUrl: 'https://bsjsilver.com/',
      crawlDelayMs: 1000,
    });
    prisma.supplierCrawlRun.create.mockResolvedValue({ id: runId, status: 'QUEUED' });

    await service.processSchedules();

    expect(prisma.supplierCrawlSchedule.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { nextRunAt: expect.any(Date) } }),
    );
    expect(prisma.supplierCrawlSchedule.update).toHaveBeenCalledWith({
      where: { id: 'schedule-1' },
      data: expect.objectContaining({
        lastEnqueuedAt: expect.any(Date),
        nextRunAt: expect.any(Date),
      }),
    });
  });

  it('returns server-paginated import drafts', async () => {
    prisma.supplierProductImportDraft.count.mockResolvedValue(31);
    prisma.supplierProductImportDraft.findMany.mockResolvedValue([{ id: 'draft-page-2' }]);

    await expect(
      service.listDrafts({ page: 2, pageSize: 12, status: 'PENDING_REVIEW' }),
    ).resolves.toEqual({
      items: [{ id: 'draft-page-2' }],
      total: 31,
      page: 2,
      pageSize: 12,
      totalPages: 3,
    });
    expect(prisma.supplierProductImportDraft.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 12, take: 12 }),
    );
  });

  it('returns server-paginated unacknowledged source changes', async () => {
    prisma.supplierProductSourceChange.count.mockResolvedValue(43);
    prisma.supplierProductSourceChange.findMany.mockResolvedValue([{ id: 'change-page-2' }]);

    await expect(service.listSourceChanges({ page: 2, pageSize: 20 })).resolves.toEqual({
      items: [{ id: 'change-page-2' }],
      total: 43,
      page: 2,
      pageSize: 20,
      totalPages: 3,
    });
    expect(prisma.supplierProductSourceChange.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { acknowledgedAt: null },
        skip: 20,
        take: 20,
      }),
    );
  });

  it('archives only a finished crawl and records the admin user', async () => {
    const userId = '10000000-0000-4000-8000-000000000005';

    await expect(service.archiveRun(runId, userId)).resolves.toEqual({
      id: runId,
      archived: true,
    });
    expect(prisma.supplierCrawlRun.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: runId, archivedAt: null }),
        data: expect.objectContaining({ archivedByUserId: userId }),
      }),
    );
  });

  it('records supplier price and availability changes without changing catalog pricing', async () => {
    prisma.supplierProductImportDraft.findUnique.mockResolvedValue({
      id: draft.id,
      productId: '10000000-0000-4000-8000-000000000006',
      status: 'IMPORTED',
      supplierRetailPriceToman: 1_000_000,
      sourceAvailability: 'OUT_OF_STOCK',
    });
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        `
          <script type="application/ld+json">
            {"@type":"Product","name":"دستبند نقره","sku":"10611820","price":"12000000","priceCurrency":"IRR","offers":{"availability":"https://schema.org/InStock"}}
          </script>
          <div id="frmSecProductMain"><h1>دستبند نقره</h1></div>
        `,
        { status: 200, headers: { 'Content-Type': 'text/html' } },
      ),
    );

    await service.crawlProduct({
      supplierSourceId: sourceId,
      targetUrl: 'https://bsjsilver.com/product/10611820-item',
    });

    expect(prisma.supplierProductSourceChange.create).toHaveBeenCalledTimes(2);
    expect(prisma.supplierProductSourceChange.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'PRICE',
        previousValue: '1000000',
        newValue: '1200000',
      }),
    });
    expect(prisma.supplierProductSourceChange.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'AVAILABILITY',
        previousValue: 'OUT_OF_STOCK',
        newValue: 'IN_STOCK',
      }),
    });
  });

  it('validates and saves a supplier-to-catalog category mapping', async () => {
    const categoryId = '10000000-0000-4000-8000-000000000004';
    const catalogCategoryId = '10000000-0000-4000-8000-000000000007';
    prisma.supplierSourceCategory.findUnique.mockResolvedValue({ id: categoryId });
    prisma.category.findFirst.mockResolvedValue({ id: catalogCategoryId });
    prisma.supplierSourceCategory.update.mockResolvedValue({
      id: categoryId,
      catalogCategoryId,
    });

    await expect(service.updateCategoryMapping(categoryId, { catalogCategoryId })).resolves.toEqual(
      { id: categoryId, catalogCategoryId },
    );
    expect(prisma.supplierSourceCategory.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: categoryId }, data: { catalogCategoryId } }),
    );
  });

  it('requeues a failed crawl for a manual retry', async () => {
    await expect(service.retryRun(runId)).resolves.toEqual({ id: runId, status: 'QUEUED' });
    expect(prisma.supplierCrawlRun.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: runId, status: 'FAILED' },
        data: expect.objectContaining({ status: 'QUEUED', retryCount: 0 }),
      }),
    );
  });

  it('uses the supplier session and queues child categories returned by a parent category', async () => {
    const parentUrl = 'https://bsjsilver.com/product/category/64444-earrings';
    const childUrl = 'https://bsjsilver.com/product/category/65785-stud-earrings';
    prisma.supplierCrawlRun.findFirst.mockResolvedValueOnce({ id: runId, startedAt: null });
    prisma.supplierCrawlRun.findUnique.mockResolvedValue({
      id: runId,
      status: 'RUNNING',
      targetUrl: parentUrl,
      currentPage: 1,
      pendingCategoryUrls: [],
      requestedLimit: 100,
      stopAtKnown: false,
      discoveredCount: 0,
      succeededCount: 0,
      failedCount: 0,
      skippedCount: 0,
      category: null,
      supplierSource: {
        id: sourceId,
        hostname: 'bsjsilver.com',
        adapterKey: 'bsj-silver',
        baseUrl: 'https://bsjsilver.com/',
        crawlDelayMs: 1000,
        isActive: true,
        deletedAt: null,
        supplier: { isActive: true, deletedAt: null },
      },
    });
    const sessionHeaders = new Headers({ 'Content-Type': 'text/html' });
    sessionHeaders.append('Set-Cookie', 'XSRF-TOKEN=token%3D; Path=/');
    sessionHeaders.append('Set-Cookie', 'Farabin_session=session-value; Path=/');
    const fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response('<html></html>', { status: 200, headers: sessionHeaders }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: 'OK', category: [{ share: childUrl }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

    await service.processBulkQueue();

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Cookie: expect.stringContaining('Farabin_session=session-value'),
          'X-XSRF-TOKEN': 'token=',
        }),
      }),
    );
    expect(prisma.supplierCrawlRun.updateMany).toHaveBeenCalledWith({
      where: { id: runId, status: 'RUNNING' },
      data: expect.objectContaining({
        status: 'QUEUED',
        targetUrl: childUrl,
        pendingCategoryUrls: [],
        currentPage: 1,
      }),
    });
  });
});
