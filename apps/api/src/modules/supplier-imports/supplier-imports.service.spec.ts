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
    supplierCrawlRun: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    supplierProductImportDraft: {
      upsert: jest.fn(),
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
    prisma.supplierProductImportDraft.upsert.mockResolvedValue(draft);
    prisma.$transaction.mockImplementation((operation: (transaction: typeof prisma) => unknown) =>
      operation(prisma),
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
});
