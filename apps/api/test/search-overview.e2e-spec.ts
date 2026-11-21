import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { Prisma } from '../src/generated/prisma/client';
import { SeoSyncStatus } from '../src/generated/prisma/enums';
import { configureApiRouting } from '../src/app.setup';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { AuthenticationGuard } from '../src/modules/auth/authentication.guard';
import { PermissionsGuard } from '../src/modules/authorization/permissions.guard';
import { PERMISSION_CODES } from '../src/modules/authorization/rbac.constants';
import { SEARCH_CONSOLE_CLIENT } from '../src/modules/seo/search-console/google-search-console.client';
import { sha256 } from '../src/modules/seo/search-console/search-console-sync-data';
import { SearchOverviewController } from '../src/modules/seo/search-console/search-overview.controller';
import { SearchOverviewService } from '../src/modules/seo/search-console/search-overview.service';

it('serves permission-protected periods and server-paged Search Console rows from matching snapshots', async () => {
  const prisma = new PrismaService(new ConfigService());
  const rollback = new Error('Roll back SEO overview fixtures');
  try {
    await prisma.$transaction(
      async (db) => {
        const property = `fixture-${randomUUID()}`;
        const { id: integrationId } = await db.seoIntegration.create({ data: { property } });
        const url = await db.seoUrlInventory.create({
          data: {
            integrationId,
            urlKey: sha256('/products/ring'),
            reportedUrl: 'https://example.test/products/ring?colour=silver',
            reportedPath: '/products/ring',
            reportedSearch: '?colour=silver',
            normalizedPath: '/products/ring',
          },
        });
        const date = (day: number) => new Date(Date.UTC(2026, 10, day));
        const run = (day: number, scheduledOn: number, capped = false) =>
          db.seoSyncRun.create({
            data: {
              integrationId,
              metricDate: date(day),
              scheduledOn: date(scheduledOn),
              searchType: 'web',
              status: SeoSyncStatus.SUCCEEDED,
              startedAt: date(scheduledOn),
              finishedAt: date(scheduledOn),
              coverage: { QUERY: { capped }, PAGE: { capped: false } },
            },
          });
        const older = await run(19, 22);
        const beforeA = await run(17, 21);
        const beforeB = await run(18, 21);
        const first = await run(19, 23, true);
        const last = await run(20, 23);
        const metric = (
          batch: typeof first,
          scope: string,
          clicks: number,
          impressions: number,
          averagePosition: number | null,
          dimensions: Partial<Prisma.SeoPerformanceDailyCreateManyInput> = {},
        ): Prisma.SeoPerformanceDailyCreateManyInput => ({
          integrationId,
          metricDate: batch.metricDate,
          dimensionKey: sha256(randomUUID()),
          searchType: 'web',
          scope,
          aggregation: scope.startsWith('PAGE') ? 'byPage' : 'byProperty',
          syncRunId: batch.id,
          sourceVersion: batch.scheduledOn,
          clicks,
          impressions,
          averagePosition,
          ...dimensions,
        });
        await db.seoPerformanceDaily.createMany({
          data: [
            metric(older, 'QUERY', 100, 150, 10, { searchQuery: 'stale silver' }),
            metric(beforeA, 'PROPERTY', 2, 10, 10),
            metric(beforeB, 'PROPERTY', 8, 90, 6),
            metric(first, 'PROPERTY', 3, 20, 6),
            metric(last, 'PROPERTY', 17, 80, 2),
            metric(first, 'DEVICE', 2, 10, 4, { device: 'MOBILE' }),
            metric(last, 'DEVICE', 4, 20, 3, { device: 'MOBILE' }),
            metric(first, 'BRAND', 1, 3, 4, { brand: 'BRANDED', brandSource: 'google' }),
            metric(last, 'BRAND', 40, 60, 3, { brand: 'BRANDED', brandSource: 'estimated' }),
            metric(first, 'QUERY', 2, 4, 6, { searchQuery: 'Silver necklace' }),
            metric(last, 'QUERY', 2, 8, null, { searchQuery: 'Silver necklace' }),
            metric(last, 'QUERY', 4, 20, 2, { searchQuery: 'silver ring' }),
            metric(last, 'PAGE', 12, 24, 2, { urlId: url.id }),
            metric(last, 'PAGE_DEVICE', 3, 14, 5, { urlId: url.id, device: 'MOBILE' }),
          ],
        });
        await db.seoSyncRun.create({
          data: {
            integrationId,
            metricDate: date(20),
            scheduledOn: date(24),
            searchType: 'web',
            status: SeoSyncStatus.FAILED,
            attempts: 5,
            errorCode: 'rate_limited',
            startedAt: date(24),
            finishedAt: date(24),
          },
        });

        const module = await Test.createTestingModule({
          controllers: [SearchOverviewController],
          providers: [
            SearchOverviewService,
            AuthenticationGuard,
            PermissionsGuard,
            {
              provide: PrismaService,
              useValue: {
                $transaction: (fn: (client: Prisma.TransactionClient) => Promise<unknown>) =>
                  fn(db),
              },
            },
            {
              provide: ConfigService,
              useValue: new ConfigService({ SEARCH_CONSOLE_SYNC_ENABLED: true }),
            },
            { provide: SEARCH_CONSOLE_CLIENT, useValue: { property } },
            {
              provide: AuthService,
              useValue: {
                authenticateAccessToken: (token: string) =>
                  Promise.resolve({
                    sessionId: randomUUID(),
                    userId: randomUUID(),
                    phone: 'test',
                    roleCodes: [],
                    permissionCodes:
                      token === 'report-reader' ? [PERMISSION_CODES.SETTINGS_READ] : [],
                  }),
              },
            },
          ],
        }).compile();
        const app = module.createNestApplication();
        configureApiRouting(app);
        app.useGlobalPipes(
          new ValidationPipe({
            transform: true,
            whitelist: true,
            forbidNonWhitelisted: true,
            transformOptions: { enableImplicitConversion: true },
          }),
        );
        app.useGlobalGuards(module.get(AuthenticationGuard), module.get(PermissionsGuard));
        await app.init();
        try {
          const api = request(app.getHttpServer());
          const path = '/api/v1/seo/search-overview';
          const selected = { startDate: '2026-11-19', endDate: '2026-11-20' };
          const overview = (query = {}) =>
            api
              .get(path)
              .set('Authorization', 'Bearer report-reader')
              .query({ ...selected, ...query });
          const rows = (query = {}) =>
            api
              .get(`${path}/rows`)
              .set('Authorization', 'Bearer report-reader')
              .query({ ...selected, kind: 'query', ...query });
          await api.get(path).query(selected).expect(401);
          await api
            .get(`${path}/rows`)
            .set('Authorization', 'Bearer no-permission')
            .query({ ...selected, kind: 'query' })
            .expect(403);
          await overview({ endDate: '2027-03-01' }).expect(400);
          await overview({ device: 'MOBILE', brand: 'BRANDED' }).expect(400);
          const full = await overview().expect(200).expect('Cache-Control', 'private, no-store');
          expect(full.body).toMatchObject({
            property,
            timeZone: 'America/Los_Angeles',
            sync: {
              lastRunStatus: 'FAILED',
              lastErrorCode: 'rate_limited',
              latestSyncedDate: '2026-11-20',
            },
            current: { days: 2, dataDays: 2, metrics: { clicks: 20, impressions: 100, ctr: 0.2 } },
            previous: {
              startDate: '2026-11-17',
              endDate: '2026-11-18',
              metrics: { clicks: 10, impressions: 100, ctr: 0.1 },
            },
            change: { clicks: 10, impressions: 0, ctr: 0.1 },
          });
          expect(full.body.current.metrics.averagePosition).toBeCloseTo(2.8);
          expect(full.body.change.averagePosition).toBeCloseTo(-3.6);
          expect(full.body.weekly[0]).toEqual(full.body.current);

          expect((await overview({ device: 'MOBILE' }).expect(200)).body).toMatchObject({
            scope: 'device',
            current: { metrics: { clicks: 6 } },
            change: null,
          });
          expect((await overview({ brand: 'BRANDED' }).expect(200)).body).toMatchObject({
            scope: 'brand',
            current: { syncedDays: 2, dataDays: 1, metrics: { clicks: 1 } },
            change: null,
          });
          expect((await overview({ searchType: 'image' }).expect(200)).body.current).toMatchObject({
            syncedDays: 0,
            dataDays: 0,
            metrics: null,
          });
          expect((await rows({ q: 'SILVER', limit: 1 }).expect(200)).body).toMatchObject({
            total: 2,
            cappedDays: 1,
            items: [{ label: 'Silver necklace', clicks: 4, averagePosition: null }],
          });
          expect(
            (await rows({ q: 'silver', limit: 1, page: 2 }).expect(200)).body.items,
          ).toMatchObject([{ label: 'silver ring', clicks: 4 }]);
          expect((await rows({ q: '%' }).expect(200)).body.items).toEqual([]);
          expect((await rows({ device: 'MOBILE' }).expect(200)).body.available).toBe(false);
          expect((await rows({ kind: 'page', device: 'MOBILE' }).expect(200)).body).toMatchObject({
            aggregation: 'byPage',
            total: 1,
            items: [{ label: url.reportedUrl, clicks: 3 }],
          });
        } finally {
          await app.close();
        }
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
