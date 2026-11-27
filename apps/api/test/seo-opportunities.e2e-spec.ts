import { ConfigService } from '@nestjs/config';
import { SeoOpportunityService } from '../src/modules/seo/opportunities/seo-opportunity.service';
import { shiftOpportunityDay } from '../src/modules/seo/opportunities/seo-opportunity-sources';
import { createIsolatedTestDatabase } from './support/isolated-test-database';

jest.setTimeout(50_000);

it('ranks canonical products, preserves decisions and compares complete windows for a correction task', async () => {
  const { db, close } = await createIsolatedTestDatabase();
  const property = 'sc-domain:hamidian.shop';
  const origin = 'https://hamidian.shop';
  const service = new SeoOpportunityService(
    db,
    new ConfigService({ STOREFRONT_PUBLIC_ORIGIN: origin }),
    { property },
  );
  const scan = new Date('2026-11-26T10:00:00Z');
  const implementedOn = '2026-11-25';

  try {
    const admin = await db.user.create({ data: { phone: '+989121000006', firstName: 'مدیر' } });
    const integration = await db.seoIntegration.create({ data: { property } });
    const product = await db.product.create({
      data: { name: 'انگشتر نقره', slug: 'ring', status: 'ACTIVE' },
    });
    const page = '/products/ring';
    const url = await db.seoUrlInventory.create({
      data: {
        integrationId: integration.id,
        urlKey: 'a'.repeat(64),
        reportedUrl: origin + page,
        reportedPath: page,
        normalizedPath: page,
        productId: product.id,
        canonicalPath: page,
      },
    });
    const fill = async (from: string, days: number, clicks: number) => {
      const runs = await db.seoSyncRun.createManyAndReturn({
        data: Array.from({ length: days }, (_, index) => ({
          integrationId: integration.id,
          searchType: 'web',
          metricDate: new Date(shiftOpportunityDay(from, index)),
          scheduledOn: scan,
          status: 'SUCCEEDED',
          finishedAt: scan,
          coverage: { PAGE: { rows: 1, capped: false, aggregation: 'byPage' } },
        })),
      });
      await db.seoPerformanceDaily.createMany({
        data: runs.map((run) => ({
          syncRunId: run.id,
          integrationId: integration.id,
          urlId: url.id,
          metricDate: run.metricDate,
          sourceVersion: run.scheduledOn,
          searchType: 'web',
          scope: 'PAGE',
          aggregation: 'byPage',
          dimensionKey: 'b'.repeat(64),
          impressions: 100,
          clicks,
          averagePosition: 10,
        })),
      });
    };
    await fill('2026-11-11', 14, 1);

    const concurrent = await Promise.all([service.refresh(scan), service.refresh(scan)]);
    expect(concurrent.reduce((sum, result) => sum + result.changed, 0)).toBe(2);
    expect(await service.refresh(scan)).toEqual({ changed: 0, hasSource: true });
    const list = await service.list(1);
    expect(list.items.map(({ rule }) => rule)).toEqual(['INTERNAL_LINKS', 'SNIPPET_CTR']);
    const snippet = list.items.find(({ rule }) => rule === 'SNIPPET_CTR');
    const links = list.items.find(({ rule }) => rule === 'INTERNAL_LINKS');
    if (!snippet || !links) throw new Error('Expected two opportunities.');
    const deferred = await service.update(
      links.id,
      admin.id,
      { action: 'DEFER', revision: links.revision, date: '2026-12-02' },
      scan,
    );
    expect(deferred.item.status).toBe('DEFERRED');
    await service.update(
      links.id,
      admin.id,
      { action: 'REJECT', revision: deferred.item.revision, note: 'محتوای مرتبط در دسترس نیست' },
      scan,
    );
    await service.refresh(scan);
    expect((await service.list(1, 'REJECTED')).items).toHaveLength(1);

    const approved = await service.update(
      snippet.id,
      admin.id,
      { action: 'APPROVE', revision: snippet.revision },
      scan,
    );
    expect(approved.item.status).toBe('APPROVED');
    await expect(
      service.update(
        snippet.id,
        admin.id,
        { action: 'CREATE_TASK', revision: snippet.revision },
        scan,
      ),
    ).rejects.toMatchObject({ status: 409 });
    const task = await service.update(
      snippet.id,
      admin.id,
      { action: 'CREATE_TASK', revision: approved.item.revision },
      scan,
    );
    if (!task.task) throw new Error('Expected a correction task.');
    await db.seoCorrectionTask.update({
      where: { id: task.task.id },
      data: { createdAt: new Date(implementedOn) },
    });
    const executed = await service.update(
      snippet.id,
      admin.id,
      {
        action: 'IMPLEMENT',
        revision: task.item.revision,
        date: implementedOn,
        windowDays: 7,
        note: 'عنوان بازبینی شد',
        confounders: 'کمپین فعال بود',
      },
      scan,
    );
    const waiting = await service.update(
      snippet.id,
      admin.id,
      { action: 'MEASURE', revision: executed.item.revision },
      scan,
    );
    expect(waiting.task?.impact).toMatchObject({
      status: 'WAITING_FOR_DATA',
      clickDifference: null,
    });
    await fill('2026-11-26', 7, 4);
    const report = await service.update(
      snippet.id,
      admin.id,
      { action: 'MEASURE', revision: waiting.item.revision },
      scan,
    );
    expect(report.task?.impact).toMatchObject({
      status: 'READY',
      clickDifference: 21,
      impressionDifference: 0,
      before: { end: '2026-11-24', clicks: 7 },
      after: { start: '2026-11-26', clicks: 28 },
    });
    expect(report.task?.confounders).toBe('کمپین فعال بود');
    expect(report.history.filter(({ action }) => action === 'MEASURE')).toHaveLength(2);
    expect(await db.product.findUniqueOrThrow({ where: { id: product.id } })).toMatchObject({
      seoTitle: null,
      seoDescription: null,
      seoNoIndex: false,
    });
  } finally {
    await close();
  }
});
