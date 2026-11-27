import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { ProductStatus, SeoRedirectEntityType, SeoSyncStatus } from '../src/generated/prisma/enums';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import type { SearchConsoleClient } from '../src/modules/seo/search-console/google-search-console.client';
import { SearchConsoleError } from '../src/modules/seo/search-console/search-console-errors';
import {
  fetchDailyMetrics,
  shiftDay,
} from '../src/modules/seo/search-console/search-console-sync-data';
import { SearchConsoleSyncStore } from '../src/modules/seo/search-console/search-console-sync.store';
import { SearchConsoleService } from '../src/modules/seo/search-console/search-console.service';

it('recovers a lease, retries a provider failure, and refreshes metrics without losing prior rows', async () => {
  const prisma = new PrismaService(new ConfigService());
  const suffix = randomUUID();
  const property = `fixture-${suffix}`;
  const slug = `ring-${suffix}`;
  const previousPath = `/products/old-${slug}`;
  const reportedUrl = `https://hamidian.shop${previousPath}?color=silver`;
  const scheduledOn = new Date('2026-11-20');
  const store = new SearchConsoleSyncStore(prisma);
  const restartedStore = new SearchConsoleSyncStore(prisma);
  try {
    const product = await prisma.product.create({
      data: { name: 'Search Console fixture', slug, status: ProductStatus.ACTIVE },
    });
    await prisma.seoRedirect.create({
      data: {
        sourcePath: previousPath,
        destinationPath: `/products/${slug}`,
        entityType: SeoRedirectEntityType.PRODUCT,
        entityId: product.id,
      },
    });
    const [integrationId, otherIntegrationId] = await Promise.all([
      store.plan(property, scheduledOn, 4, ['web']),
      restartedStore.plan(property, scheduledOn, 4, ['web']),
    ]);
    expect(otherIntegrationId).toBe(integrationId);
    expect(await prisma.seoSyncRun.count({ where: { integrationId } })).toBe(4);

    const claims = await Promise.all([
      store.claim(integrationId, new Date()),
      restartedStore.claim(integrationId, new Date()),
    ]);
    const [first] = claims.flatMap((claim) => (claim ? [claim] : []));
    expect(claims.filter(Boolean)).toHaveLength(1);
    expect(first.attempts).toBe(1);
    expect(first.metricDate).toEqual(new Date('2026-11-17'));
    await prisma.seoSyncRun.update({
      where: { id: first.id },
      data: { leaseUntil: new Date(Date.now() - 10_000) },
    });
    const recovered = await restartedStore.claim(integrationId, new Date());
    expect(recovered).toMatchObject({ id: first.id, attempts: 2, status: SeoSyncStatus.RUNNING });
    if (!recovered) throw new Error('The expired job was not reclaimed.');
    await expect(store.complete(first, { rows: [], coverage: {} })).resolves.toBe(false);
    await expect(
      restartedStore.fail(recovered, new SearchConsoleError('rate_limited', 420)),
    ).resolves.toBe(true);
    await expect(store.claim(integrationId, new Date())).resolves.toBeNull();
    expect(await prisma.seoSyncRun.findUnique({ where: { id: first.id } })).toMatchObject({
      status: SeoSyncStatus.PENDING,
      errorCode: 'rate_limited',
      leaseUntil: null,
    });

    await prisma.seoSyncRun.update({
      where: { id: first.id },
      data: { availableAt: new Date(Date.now() - 10_000) },
    });
    await prisma.seoIntegration.update({
      where: { id: integrationId },
      data: { pausedUntil: null },
    });
    const attempt = await store.claim(integrationId, new Date());
    expect(attempt).toMatchObject({ id: first.id, attempts: 3 });
    if (!attempt) throw new Error('The queued retry was not claimed.');

    const metric = { clicks: 2, impressions: 10, ctr: 0.2, position: 4 };
    const client: SearchConsoleClient = {
      property,
      checkAccess: async () => undefined,
      listSitemaps: async () => ({}),
      query: async ({ dimensions }) => {
        const keys = dimensions.map((dimension) => {
          if (dimension === 'page') return reportedUrl;
          if (dimension === 'device') return 'MOBILE';
          if (dimension === 'query') return 'silver ring';
          return 'BRANDED';
        });
        return {
          responseAggregationType: dimensions.includes('page') ? 'byPage' : 'byProperty',
          rows: [{ ...metric, keys }],
        };
      },
    };
    const service = new SearchConsoleService(client);
    const data = await fetchDailyMetrics(service, property, attempt.metricDate, 'web');
    expect(data.rows).toHaveLength(7);
    await expect(store.complete(attempt, data)).resolves.toBe(true);
    await expect(store.complete(attempt, data)).resolves.toBe(false);
    const url = await prisma.seoUrlInventory.findFirst({ where: { integrationId } });
    expect(url).toMatchObject({
      reportedUrl,
      reportedPath: previousPath,
      reportedSearch: '?color=silver',
      productId: product.id,
      canonicalPath: `/products/${slug}`,
      matchedBy: 'redirect',
    });
    expect(
      await prisma.seoPerformanceDaily.count({ where: { integrationId, urlId: url?.id } }),
    ).toBe(3);
    expect(await prisma.seoSyncRun.findUnique({ where: { id: first.id } })).toMatchObject({
      status: SeoSyncStatus.SUCCEEDED,
      rowCount: 7,
      errorCode: null,
    });

    const nextDay = shiftDay(scheduledOn, 1);
    await store.plan(property, nextDay, 4, ['web']);
    await prisma.seoSyncRun.updateMany({
      where: {
        integrationId,
        status: SeoSyncStatus.PENDING,
        NOT: { scheduledOn: nextDay, metricDate: attempt.metricDate },
      },
      data: { availableAt: new Date(Date.now() + 3_600_000) },
    });
    const refresh = await store.claim(integrationId, new Date());
    expect(refresh).toMatchObject({ metricDate: attempt.metricDate, scheduledOn: nextDay });
    if (!refresh) throw new Error('The restricted refresh job was not queued.');
    const total = data.rows.find(({ scope }) => scope === 'PROPERTY');
    if (!total) throw new Error('The fixture has no property total.');
    await expect(
      store.complete(refresh, {
        rows: [{ ...total, clicks: 3, impressions: 15 }],
        coverage: { PROPERTY: { rows: 1, aggregation: 'byProperty', capped: false } },
      }),
    ).resolves.toBe(true);

    const saved = await prisma.seoPerformanceDaily.findMany({ where: { integrationId } });
    expect(saved).toHaveLength(7);
    expect(saved.find(({ scope }) => scope === 'PROPERTY')).toMatchObject({
      clicks: 3,
      impressions: 15,
      sourceVersion: nextDay,
    });
    expect(saved.find(({ scope }) => scope === 'PAGE')).toMatchObject({
      clicks: 2,
      impressions: 10,
      sourceVersion: scheduledOn,
    });
    expect(await store.status(property, attempt.metricDate, attempt.metricDate)).toMatchObject({
      lastSuccess: { rowCount: 1 },
      webPropertyRollup: { totals: { clicks: 3, impressions: 15, ctr: 0.2, averagePosition: 4 } },
    });

    const overdue = await prisma.seoSyncRun.create({
      data: {
        integrationId,
        metricDate: attempt.metricDate,
        scheduledOn: shiftDay(scheduledOn, -1),
        searchType: 'web',
      },
    });
    const lateAttempt = await store.claim(integrationId, new Date());
    expect(lateAttempt).toMatchObject({ id: overdue.id });
    if (!lateAttempt) throw new Error('The overdue fixture was not claimed.');
    await expect(
      store.complete(lateAttempt, {
        rows: [{ ...total, clicks: 1 }],
        coverage: {},
      }),
    ).resolves.toBe(true);
    expect(
      await prisma.seoPerformanceDaily.findFirst({
        where: { integrationId, scope: 'PROPERTY' },
      }),
    ).toMatchObject({ clicks: 3, syncRunId: refresh.id, sourceVersion: nextDay });
  } finally {
    try {
      await prisma.seoIntegration.deleteMany({ where: { property } });
      await prisma.seoRedirect.deleteMany({ where: { sourcePath: previousPath } });
      await prisma.product.deleteMany({ where: { slug } });
    } finally {
      await prisma.$disconnect();
    }
  }
}, 30_000);
