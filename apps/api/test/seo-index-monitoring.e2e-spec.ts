import { ConfigService } from '@nestjs/config';
import { emptyObservation } from '../src/modules/seo/audit/seo-audit-crawl';
import { SeoIndexMonitoringService } from '../src/modules/seo/inspection/seo-index-monitoring.service';
import { readGoogleIndex } from '../src/modules/seo/inspection/seo-index-observation';
import { SeoInspectionStore } from '../src/modules/seo/inspection/seo-inspection-store';
import { SearchConsoleError } from '../src/modules/seo/search-console/search-console-errors';
import { createIsolatedTestDatabase } from './support/isolated-test-database';

jest.setTimeout(50_000);

it('serializes inspection claims, pauses quota and compares dated evidence after recovery', async () => {
  const { db, close } = await createIsolatedTestDatabase();
  const property = 'sc-domain:hamidian.shop';
  const origin = 'https://hamidian.shop';
  const path = '/products/ring';
  const scope = { property, origin };
  const store = new SeoInspectionStore(db);
  const restarted = new SeoInspectionStore(db);
  const firstTime = new Date('2026-11-25T08:00:00Z');
  const resumedAt = new Date('2026-11-26T08:20:00Z');
  const auditAt = new Date('2026-11-26T08:21:00Z');
  const sitemapAt = new Date('2026-11-26T08:19:00Z');
  const candidate = { path, source: 'CONTENT', priority: 3 };

  try {
    expect(await store.plan(scope, firstTime, [candidate], 1)).toBe(1);
    expect(await store.plan(scope, firstTime, [candidate], 1)).toBe(0);
    const concurrent = await Promise.all([
      store.claim(scope, 1, firstTime),
      restarted.claim(scope, 1, firstTime),
    ]);
    expect(concurrent.filter(Boolean)).toHaveLength(1);
    const first = concurrent.find((entry) => entry !== null);
    if (!first) throw new Error('No inspection was claimed.');
    await expect(
      store.finish(first, { failure: new SearchConsoleError('quota_exceeded', 60) }, firstTime),
    ).resolves.toBe(true);
    expect(await restarted.claim(scope, 1, new Date('2026-11-26T07:59:00Z'))).toBeNull();
    const resumed = await restarted.claim(scope, 1, resumedAt);
    if (!resumed) throw new Error('The paused inspection was not reclaimed.');
    const google = readGoogleIndex({
      inspectionResult: {
        indexStatusResult: {
          verdict: 'NEUTRAL',
          coverageState: 'Discovered - currently not indexed',
        },
      },
    });
    await expect(store.finish(first, { observation: google }, resumedAt)).resolves.toBe(false);
    await expect(restarted.finish(resumed, { observation: google }, resumedAt)).resolves.toBe(true);
    expect(await db.seoInspectionState.findUniqueOrThrow({ where: { property } })).toMatchObject({
      used: 1,
      pausedUntil: null,
    });

    await db.seoAuditRun.create({
      data: {
        origin,
        ruleVersion: 1,
        sitemapChecked: true,
        finishedAt: auditAt,
        checks: {
          createMany: {
            data: [
              { path: '/sitemap.xml', priority: 0, source: 'SITEMAP_FILE', checkedAt: sitemapAt },
              {
                path,
                priority: 1,
                source: 'PRODUCT',
                checkedAt: auditAt,
                inSitemap: true,
                observation: {
                  ...emptyObservation(path),
                  status: 200,
                  html: true,
                  canonicals: [origin + path],
                },
              },
            ],
          },
        },
      },
    });
    const monitoring = new SeoIndexMonitoringService(
      db,
      restarted,
      new ConfigService({ SEO_INSPECTION_ORIGIN: origin }),
      { property, inspect: jest.fn() },
    );
    await expect(monitoring.overview(1)).resolves.toMatchObject({
      items: [
        {
          path,
          google: { verdict: 'NEUTRAL', observedAt: resumedAt.toISOString() },
          technical: { status: 200, observedAt: auditAt.toISOString() },
          sitemap: { present: true, observedAt: sitemapAt.toISOString() },
          differences: ['GOOGLE_COVERAGE_HTTP_200'],
        },
      ],
    });
    const file = Buffer.from(`URL,Last crawled\n${origin}${path},2026-11-20`);
    // Report date is relative to the API clock and keeps this fixture independent of the test date.
    const reportDate = '2024-01-15';
    const report = await monitoring.importCoverage(file, 'Discovered', reportDate);
    await expect(monitoring.importCoverage(file, 'Discovered', reportDate)).resolves.toEqual(
      report,
    );
    await expect(monitoring.coverage(report.id, 1, 'Discovered')).resolves.toMatchObject({
      report: { reportDate, rowCount: 1 },
      reasons: ['Discovered'],
      total: 1,
      rows: [{ url: origin + path }],
    });
  } finally {
    await close();
  }
});
