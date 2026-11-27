import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { readAuditInventory } from '../audit/seo-audit-inventory';
import { inspectionPath } from './seo-index-observation';

export type InspectionCandidate = { path: string; source: string; priority: number };

export async function inspectionCandidates(
  db: PrismaService,
  property: string,
  origin: string,
  now: Date,
) {
  const since = new Date(now.getTime() - 30 * 86_400_000);
  const [inventory, top, flagged] = await Promise.all([
    readAuditInventory(db, origin, now),
    db.$queryRaw<{ url: string }[]>(Prisma.sql`
      SELECT u."reportedUrl" AS url
      FROM "seo_integrations" i
      JOIN "seo_performance_daily" p ON p."integrationId" = i.id
      JOIN "seo_url_inventory" u ON u.id = p."urlId"
      WHERE i.property = ${property} AND p.scope = 'PAGE' AND p."searchType" = 'web'
        AND p."metricDate" >= ${since}::date AND u."reportedSearch" IS NULL
      GROUP BY u."reportedUrl" ORDER BY SUM(p.clicks) DESC, SUM(p.impressions) DESC, url LIMIT 100
    `),
    db.seoAuditCheck.findMany({
      where: {
        run: { origin, finishedAt: { not: null } },
        checkedAt: { gte: since },
        NOT: [{ issues: { equals: Prisma.DbNull } }, { issues: { equals: [] } }],
      },
      select: { path: true },
      orderBy: [{ checkedAt: 'desc' }, { path: 'asc' }],
      take: 100,
    }),
  ]);

  const candidates = new Map<string, InspectionCandidate>();
  for (const [source, priority, urls] of [
    ['AUDIT', 1, flagged.map(({ path }) => path)],
    ['PERFORMANCE', 2, top.map(({ url }) => url)],
    [
      'CONTENT',
      3,
      inventory
        .filter(({ source }) => ['PRODUCT', 'PUBLISHED', 'CAMPAIGN', 'HUB'].includes(source))
        .map(({ path }) => path),
    ],
  ] as const) {
    for (const url of urls) {
      const path = inspectionPath(origin, url);
      if (path && !candidates.has(path)) candidates.set(path, { path, source, priority });
    }
  }
  return [...candidates.values()];
}
