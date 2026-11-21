import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import type { Prisma } from '../src/generated/prisma/client';
import {
  GuideArticleStatus,
  ProductStatus,
  SeoRedirectEntityType,
  SeoSyncStatus,
} from '../src/generated/prisma/enums';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import type { SearchConsoleClient } from '../src/modules/seo/search-console/google-search-console.client';
import { sha256 } from '../src/modules/seo/search-console/search-console-sync-data';
import { saveReportedUrls } from '../src/modules/seo/search-console/search-console-url-inventory';
import { SearchEntityService } from '../src/modules/seo/search-console/search-entity.service';

it('isolates each reported URL, ranks qualified canonical pages and excludes removed entities', async () => {
  const prisma = new PrismaService(new ConfigService());
  const rollback = new Error('Roll back SEO entity fixtures');
  try {
    await prisma.$transaction(
      async (db) => {
        const suffix = randomUUID();
        const origin = 'https://hamidian.shop';
        const property = `fixture-${suffix}`;
        const { id: integrationId } = await db.seoIntegration.create({ data: { property } });
        const report = new SearchEntityService(
          {
            $transaction: (fn: (client: Prisma.TransactionClient) => Promise<unknown>) => fn(db),
          } as unknown as PrismaService,
          new ConfigService({ STOREFRONT_PUBLIC_ORIGIN: origin }),
          {
            property,
          } as SearchConsoleClient,
        );
        const createProduct = (label: string, seoNoIndex = false) =>
          db.product.create({
            data: {
              name: `${label} ${suffix}`,
              slug: `${label}-${suffix}`,
              status: ProductStatus.ACTIVE,
              seoNoIndex,
            },
          });
        const main = await createProduct('انگشتر');
        const rising = await createProduct('rising');
        const low = await createProduct('low');
        const excluded = await createProduct('excluded', true);
        const otherUrls = [rising, low, excluded].map(
          (row) => new URL(`/products/${row.slug}`, origin).href,
        );
        const primaryUrl = new URL(`/products/${main.slug}`, origin).href;
        const historicalPath = `/products/old-${suffix}`;
        const historicalUrl = `${origin}${historicalPath}`;
        const parameterUrl = `${primaryUrl}?utm_source=test`;
        await db.seoRedirect.create({
          data: {
            sourcePath: historicalPath,
            destinationPath: `/products/${main.slug}`,
            entityType: SeoRedirectEntityType.PRODUCT,
            entityId: main.id,
          },
        });
        const saved = await saveReportedUrls(db, integrationId, [
          primaryUrl,
          historicalUrl,
          parameterUrl,
          ...otherUrls,
        ]);
        const urlId = (url: string) => {
          const id = saved.get(sha256(url));
          if (!id) throw new Error('Expected a saved URL');
          return id;
        };
        const date = (day: number) => new Date(Date.UTC(2026, 10, day));
        const run = (day: number) =>
          db.seoSyncRun.create({
            data: {
              integrationId,
              metricDate: date(day),
              scheduledOn: date(23),
              searchType: 'web',
              status: SeoSyncStatus.SUCCEEDED,
              startedAt: date(23),
              finishedAt: date(23),
              coverage: { PAGE_QUERY: { capped: true } },
            },
          });
        const previous = await run(19);
        const current = await run(20);
        const metric = (
          batch: typeof previous,
          url: string,
          clicks: number,
          impressions: number,
          dimensions: Partial<Prisma.SeoPerformanceDailyCreateManyInput> = {},
        ): Prisma.SeoPerformanceDailyCreateManyInput => ({
          integrationId,
          metricDate: batch.metricDate,
          dimensionKey: sha256(randomUUID()),
          searchType: 'web',
          scope: 'PAGE',
          aggregation: 'byPage',
          urlId: urlId(url),
          syncRunId: batch.id,
          sourceVersion: batch.scheduledOn,
          clicks,
          impressions,
          averagePosition: 4,
          ...dimensions,
        });
        await db.seoPerformanceDaily.createMany({
          data: [
            metric(previous, primaryUrl, 15, 100),
            metric(current, primaryUrl, 3, 300),
            metric(current, parameterUrl, 90, 2000),
            metric(current, historicalUrl, 20, 150),
            metric(current, historicalUrl, 2, 20, {
              scope: 'PAGE_QUERY',
              searchQuery: 'silver ring',
            }),
            metric(current, historicalUrl, 10, 24, { scope: 'PAGE_DEVICE', device: 'MOBILE' }),
            metric(previous, otherUrls[0], 10, 150),
            metric(current, otherUrls[0], 45, 200),
            metric(current, otherUrls[1], 0, 2, { averagePosition: null }),
            metric(current, otherUrls[2], 1, 500),
          ],
        });

        const dates = { startDate: '2026-11-20', endDate: '2026-11-20' };
        const primary = await report.detail('product', main.id, dates);
        expect(primary).toMatchObject({
          entity: { id: main.id, canonicalUrl: primaryUrl },
          selectedUrl: { reportedUrl: primaryUrl, isCanonical: true },
          current: { metrics: { clicks: 3, impressions: 300, ctr: 0.01 } },
          previous: { metrics: { clicks: 15 } },
          change: { clicks: -12 },
          topQueries: [],
          devices: [],
          sufficient: true,
          urlTotal: 3,
        });
        expect(primary.urls).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              reportedUrl: historicalUrl,
              matchedBy: 'redirect',
              isCanonical: false,
            }),
            expect.objectContaining({
              reportedUrl: parameterUrl,
              reportedSearch: '?utm_source=test',
              isCanonical: false,
            }),
          ]),
        );
        const alias = await report.detail('product', main.id, {
          ...dates,
          urlId: urlId(historicalUrl),
        });
        expect(alias).toMatchObject({
          entity: { canonicalUrl: primaryUrl },
          current: { metrics: { clicks: 20 } },
          change: null,
          topQueries: [{ label: 'silver ring', clicks: 2 }],
          devices: [{ label: 'MOBILE', clicks: 10 }],
        });
        await expect(
          report.detail('product', main.id, { ...dates, urlId: urlId(otherUrls[0]) }),
        ).rejects.toThrow('not associated');
        await expect(report.detail('product', low.id, dates)).resolves.toMatchObject({
          sufficient: false,
          current: { metrics: { averagePosition: null } },
        });

        const filter = { ...dates, kind: 'product' as const, q: suffix };
        const list = await report.list(filter);
        expect(list).toMatchObject({
          total: 4,
          items: [
            { id: excluded.id, opportunities: [] },
            { id: main.id, opportunities: ['low-ctr', 'decline'], clickChangePercent: -80 },
            { id: rising.id, opportunities: ['growth'] },
            { id: low.id, opportunities: [], sufficient: false },
          ],
        });
        await expect(
          report.list({ ...filter, opportunity: 'low-ctr', minimumImpressions: 301 }),
        ).resolves.toMatchObject({ total: 0 });
        await expect(
          report.list({ ...filter, opportunity: 'growth', minimumPreviousClicks: 11 }),
        ).resolves.toMatchObject({ total: 0 });
        await expect(
          report.list({ ...filter, opportunity: 'decline', page: 2 }),
        ).resolves.toMatchObject({ total: 1, items: [] });
        await db.product.update({ where: { id: main.id }, data: { deletedAt: new Date() } });
        await expect(report.detail('product', main.id, dates)).rejects.toThrow('not found');
        await expect(report.list(filter)).resolves.toMatchObject({ total: 3 });

        const category = await db.category.create({ data: { name: 'Fixture', slug: suffix } });
        const brand = await db.brand.create({ data: { name: 'Fixture', slug: suffix } });
        const article = await db.guideArticle.create({
          data: {
            title: 'Fixture',
            slug: suffix,
            status: GuideArticleStatus.PUBLISHED,
            publishedAt: date(18),
          },
        });
        await expect(report.detail('category', category.id, dates)).resolves.toMatchObject({
          entity: { canonicalUrl: `${origin}/categories/${suffix}` },
          current: { metrics: null },
        });
        await expect(report.detail('brand', brand.id, dates)).resolves.toMatchObject({
          entity: { canonicalUrl: `${origin}/brands/${suffix}` },
          sufficient: false,
        });
        await expect(report.detail('article', article.id, dates)).resolves.toMatchObject({
          entity: { canonicalUrl: `${origin}/guide/${suffix}` },
          selectedUrl: null,
        });
        throw rollback;
      },
      { timeout: 25_000 },
    );
  } catch (error) {
    if (error !== rollback) throw error;
  } finally {
    await prisma.$disconnect();
  }
}, 35_000);
