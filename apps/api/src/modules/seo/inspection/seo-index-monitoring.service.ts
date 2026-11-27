import { createHash } from 'node:crypto';
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { AuditObservation } from '../audit/seo-audit-crawl';
import { hasAuditNoindex } from '../audit/seo-audit-rules';
import {
  SEARCH_CONSOLE_CLIENT,
  type GoogleSearchConsoleClient,
} from '../search-console/google-search-console.client';
import { SearchConsoleError } from '../search-console/search-console-errors';
import { coverageDate, parseCoverageUpload, type CoverageRow } from './seo-coverage-import';
import { inspectionCandidates } from './seo-index-candidates';
import {
  compareIndexEvidence,
  inspectionScope,
  readGoogleIndex,
  type GoogleIndex,
} from './seo-index-observation';
import { inspectionDay, SeoInspectionStore } from './seo-inspection-store';

const day = 86_400_000;
const inspectionPageSize = 20;

@Injectable()
export class SeoIndexMonitoringService {
  private readonly scope: { property: string; origin: string } | null;
  private readonly limit: number;
  private readonly canInspect: boolean;

  constructor(
    private readonly db: PrismaService,
    private readonly store: SeoInspectionStore,
    private readonly config: ConfigService,
    @Inject(SEARCH_CONSOLE_CLIENT)
    private readonly google: Pick<GoogleSearchConsoleClient, 'property' | 'inspect'>,
  ) {
    const origin = inspectionScope(
      google.property,
      config.get<string>('SEO_INSPECTION_ORIGIN') ?? config.get<string>('STOREFRONT_PUBLIC_ORIGIN'),
    );
    this.scope = origin ? { property: google.property, origin } : null;
    this.limit = config.get<number>('SEO_INSPECTION_DAILY_LIMIT') ?? 30;
    this.canInspect = Boolean(this.scope && config.get<string>('SEARCH_CONSOLE_CREDENTIALS_FILE'));
  }

  async queue(now = new Date()) {
    if (!this.scope || !this.canInspect) {
      throw new ServiceUnavailableException('Search Console URL Inspection is not configured.');
    }
    const existing = await this.db.seoInspectionState.findUnique({
      where: { property: this.scope.property },
      select: { plannedDay: true },
    });
    if (existing?.plannedDay?.getTime() === inspectionDay(now).getTime()) return { queued: 0 };
    const candidates = await inspectionCandidates(
      this.db,
      this.scope.property,
      this.scope.origin,
      now,
    );
    return { queued: await this.store.plan(this.scope, now, candidates, this.limit) };
  }

  @Cron(CronExpression.EVERY_MINUTE, { name: 'seo-index-inspection', waitForCompletion: true })
  async tick(): Promise<void> {
    if (!this.scope || !this.canInspect) return;
    if (this.config.get<boolean>('SEO_INSPECTION_ENABLED')) await this.queue();
    const claim = await this.store.claim(this.scope, this.limit, new Date());
    if (!claim) return;
    let result;
    try {
      result = {
        observation: readGoogleIndex(
          await this.google.inspect(new URL(claim.target.path, this.scope.origin).href),
        ),
      };
    } catch (error) {
      result = {
        failure:
          error instanceof SearchConsoleError
            ? error
            : new SearchConsoleError('upstream_unavailable'),
      };
    }
    await this.store.finish(claim, result, new Date());
  }

  async overview(page: number, search?: string) {
    const now = new Date();
    const base = {
      configured: this.canInspect,
      origin: this.scope?.origin ?? null,
      property: this.scope?.property ?? null,
      automatic: this.config.get<boolean>('SEO_INSPECTION_ENABLED') === true,
      limit: this.limit,
      used: 0,
      pending: 0,
      pausedUntil: null as string | null,
      pauseReason: null as string | null,
      budgetResetsAt: new Date(inspectionDay(now).getTime() + day).toISOString(),
      total: 0,
      page,
      pageSize: inspectionPageSize,
    };
    if (!this.scope) return { ...base, items: [] };
    const { property, origin } = this.scope;
    const where = {
      ...this.scope,
      ...(search ? { path: { contains: search, mode: 'insensitive' as const } } : {}),
    };
    const [state, rows, total, pending] = await Promise.all([
      this.db.seoInspectionState.findUnique({ where: { property } }),
      this.db.seoInspectionTarget.findMany({
        where,
        skip: (page - 1) * inspectionPageSize,
        take: inspectionPageSize,
        orderBy: [
          { queued: 'desc' },
          { lastAttemptAt: { sort: 'desc', nulls: 'last' } },
          { path: 'asc' },
        ],
      }),
      this.db.seoInspectionTarget.count({ where }),
      this.db.seoInspectionTarget.count({ where: { ...this.scope, queued: true } }),
    ]);
    const audits = rows.length
      ? await this.db.$queryRaw<
          {
            path: string;
            checkedAt: Date;
            inSitemap: boolean | null;
            sitemapCheckedAt: Date | null;
            observation: Prisma.JsonValue;
          }[]
        >(Prisma.sql`
      SELECT DISTINCT ON (c.path) c.path, c."checkedAt", c."inSitemap", c.observation,
             sitemap."checkedAt" AS "sitemapCheckedAt"
      FROM "seo_audit_checks" c JOIN "seo_audit_runs" r ON r.id = c."runId"
      LEFT JOIN "seo_audit_checks" sitemap ON sitemap."runId" = c."runId" AND sitemap.path = '/sitemap.xml'
      WHERE r.origin = ${origin} AND c.path IN (${Prisma.join(rows.map(({ path }) => path))})
        AND c."checkedAt" IS NOT NULL
      ORDER BY c.path, c."checkedAt" DESC, c."runId" DESC
    `)
      : [];
    const local = new Map(audits.map((row) => [row.path, row]));
    return {
      ...base,
      used: state?.budgetDay.getTime() === inspectionDay(now).getTime() ? state.used : 0,
      pending,
      total,
      pausedUntil:
        state?.pausedUntil && state.pausedUntil > now ? state.pausedUntil.toISOString() : null,
      pauseReason: state?.pausedUntil && state.pausedUntil > now ? state.pauseReason : null,
      items: rows.map((row) => {
        const audit = local.get(row.path);
        const observation = (audit?.observation ?? null) as AuditObservation | null;
        const google = row.observedAt ? (row.observation as GoogleIndex | null) : null;
        const inSitemap = audit?.inSitemap ?? null;
        const url = new URL(row.path, origin).href;
        return {
          url,
          path: row.path,
          prioritySource: row.source,
          queued: row.queued,
          lastAttemptAt: row.lastAttemptAt?.toISOString() ?? null,
          lastError: row.lastError,
          google:
            google && row.observedAt
              ? {
                  ...google,
                  observedAt: row.observedAt.toISOString(),
                  stale: now.getTime() - row.observedAt.getTime() > 30 * day,
                  incomplete: !google.verdict || !google.coverageState,
                }
              : null,
          technical:
            audit && observation
              ? {
                  observedAt: audit.checkedAt.toISOString(),
                  status: observation.status,
                  canonical: observation.canonicals[0] ?? null,
                  noindex: observation.html ? hasAuditNoindex(observation.robots) : null,
                  failure: observation.failure,
                  finalPath: observation.finalPath,
                  stale: now.getTime() - audit.checkedAt.getTime() > 30 * day,
                }
              : null,
          sitemap:
            audit?.sitemapCheckedAt && inSitemap !== null
              ? {
                  observedAt: audit.sitemapCheckedAt.toISOString(),
                  present: inSitemap,
                  stale: now.getTime() - audit.sitemapCheckedAt.getTime() > 30 * day,
                }
              : null,
          differences: compareIndexEvidence(url, google, observation, inSitemap),
        };
      }),
    };
  }

  async importCoverage(bytes: Buffer | undefined, label: string, reportDate: string) {
    if (!this.scope)
      throw new ServiceUnavailableException(
        'A Search Console property and matching HTTPS origin are required.',
      );
    if (
      !bytes ||
      !label.trim() ||
      !coverageDate(reportDate) ||
      reportDate > inspectionDay(new Date()).toISOString().slice(0, 10)
    ) {
      throw new BadRequestException('A Coverage export, label and valid report date are required.');
    }
    const normalizedLabel = label.trim();
    const rows = parseCoverageUpload(bytes, this.scope.origin, normalizedLabel);
    const digest = createHash('sha256')
      .update(JSON.stringify([normalizedLabel, reportDate, rows]))
      .digest('hex');
    const batch = await this.db.seoCoverageImport.upsert({
      where: { property_origin_digest: { ...this.scope, digest } },
      create: {
        ...this.scope,
        label: normalizedLabel,
        reportDate: new Date(reportDate),
        digest,
        rowCount: rows.length,
        rows,
      },
      update: {},
      select: { id: true },
    });
    return batch;
  }

  async coverage(id: string | undefined, page: number, reason?: string) {
    const metadata = {
      id: true,
      label: true,
      reportDate: true,
      importedAt: true,
      rowCount: true,
    } as const;
    const history = this.scope
      ? await this.db.seoCoverageImport.findMany({
          where: this.scope,
          select: metadata,
          take: 10,
          orderBy: [{ importedAt: 'desc' }, { id: 'desc' }],
        })
      : [];
    const selected = id ?? history[0]?.id;
    const batch =
      this.scope && selected
        ? await this.db.seoCoverageImport.findFirst({
            where: { ...this.scope, id: selected },
            select: { ...metadata, rows: true },
          })
        : null;
    if (selected && !batch) throw new NotFoundException('Coverage import not found.');
    const all = (batch?.rows ?? []) as CoverageRow[];
    const rows = reason ? all.filter((row) => row.reason === reason) : all;
    const summary = (item: (typeof history)[number]) => ({
      ...item,
      reportDate: item.reportDate.toISOString().slice(0, 10),
      importedAt: item.importedAt.toISOString(),
    });
    return {
      history: history.map(summary),
      report: batch
        ? summary({
            id: batch.id,
            label: batch.label,
            reportDate: batch.reportDate,
            importedAt: batch.importedAt,
            rowCount: batch.rowCount,
          })
        : null,
      reasons: [...new Set(all.flatMap((row) => (row.reason ? [row.reason] : [])))].sort(),
      page,
      pageSize: inspectionPageSize,
      total: rows.length,
      rows: rows.slice((page - 1) * inspectionPageSize, page * inspectionPageSize),
    };
  }
}
