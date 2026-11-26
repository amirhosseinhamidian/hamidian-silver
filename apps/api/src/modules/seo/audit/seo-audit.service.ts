import { randomUUID } from 'node:crypto';
import {
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import type { Prisma, SeoAuditCheck, SeoAuditRun } from '../../../generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { auditOrigin, createAuditCrawler, type AuditObservation } from './seo-audit-crawl';
import {
  AUDIT_MAX_TARGETS,
  readAuditedProductStock,
  readAuditInventory,
  type AuditSeed,
} from './seo-audit-inventory';
import {
  AUDIT_RULE_VERSION,
  auditMetadataKey,
  evaluateAudit,
  type AuditFinding,
  type AuditIssue,
} from './seo-audit-rules';

const RETRIES = 3;
const BATCH_SIZE = 3;
const LEASE_MS = 80_000;

function readObservation(row: SeoAuditCheck): AuditObservation | null {
  return row.observation as AuditObservation | null;
}

function readIssues(row: SeoAuditCheck): AuditIssue[] {
  return (row.issues ?? []) as AuditIssue[];
}

function retryable(observation: AuditObservation) {
  return observation.failure === 'UPSTREAM' || observation.failure === 'NETWORK';
}

@Injectable()
export class SeoAuditService {
  private readonly origin: string | null;

  constructor(
    private readonly db: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.origin = auditOrigin(config.get<string>('STOREFRONT_PUBLIC_ORIGIN'));
  }

  private async queue(origin: string, automated: boolean) {
    const now = new Date();
    const since = new Date(now.getTime() - 24 * 60 * 60_000);
    const recent = {
      origin,
      OR: [{ finishedAt: null }, ...(automated ? [{ createdAt: { gte: since } }] : [])],
    };
    if (await this.db.seoAuditRun.findFirst({ where: recent, select: { id: true } })) return null;
    const seeds = await readAuditInventory(this.db, origin, now);
    return this.db.$transaction(async (tx) => {
      const [lock] = await tx.$queryRaw<{ acquired: boolean }[]>`
        SELECT pg_try_advisory_xact_lock(17026, hashtext(${origin})) AS acquired
      `;
      if (
        !lock?.acquired ||
        (await tx.seoAuditRun.findFirst({ where: recent, select: { id: true } }))
      ) {
        return null;
      }
      return tx.seoAuditRun.create({
        data: { origin, ruleVersion: AUDIT_RULE_VERSION, checks: { createMany: { data: seeds } } },
        select: { id: true },
      });
    });
  }

  async start() {
    if (!this.origin)
      throw new ServiceUnavailableException('Public storefront origin is unavailable.');
    const run = await this.queue(this.origin, false);
    if (!run) throw new ConflictException('A technical SEO audit is already queued or running.');
    return run;
  }

  async overview(runId?: string) {
    const origin = this.origin ?? '';
    const history = await this.db.seoAuditRun.findMany({
      where: { origin },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 10,
      select: {
        id: true,
        ruleVersion: true,
        createdAt: true,
        finishedAt: true,
        sitemapChecked: true,
      },
    });
    const id = runId ?? history[0]?.id;
    const selected = id
      ? await this.db.seoAuditRun.findFirst({
          where: { id, origin },
          select: {
            id: true,
            ruleVersion: true,
            createdAt: true,
            finishedAt: true,
            sitemapChecked: true,
            checks: { orderBy: [{ priority: 'asc' }, { path: 'asc' }] },
          },
        })
      : null;
    if (id && !selected) throw new NotFoundException('Technical SEO audit not found.');
    const summarize = (run: (typeof history)[number]) => ({
      id: run.id,
      ruleVersion: run.ruleVersion,
      createdAt: run.createdAt.toISOString(),
      finishedAt: run.finishedAt?.toISOString() ?? null,
      sitemapChecked: run.sitemapChecked,
    });
    return {
      configured: Boolean(this.origin),
      history: history.map(summarize),
      run: selected ? summarize(selected) : null,
      checks:
        selected?.checks.map((check) => {
          const observation = readObservation(check);
          return {
            path: check.path,
            source: check.source,
            inSitemap: check.inSitemap,
            sourcePath: check.sourcePath,
            checkedAt: check.checkedAt?.toISOString() ?? null,
            observation: observation && {
              status: observation.status,
              finalPath: observation.finalPath,
              redirects: observation.redirects,
              failure: observation.failure,
              title: observation.title,
              description: observation.description,
              canonicals: observation.canonicals,
              robots: observation.robots,
              schema: observation.schema,
            },
            issues: readIssues(check),
          };
        }) ?? [],
    };
  }

  @Cron('*/15 * * * * *', { name: 'seo-technical-audit', waitForCompletion: true })
  async tick(): Promise<void> {
    if (!this.origin) return;
    const origin = this.origin;
    if (this.config.get<boolean>('SEO_AUDIT_ENABLED')) await this.queue(origin, true);

    const now = new Date();
    const available = {
      origin,
      finishedAt: null,
      AND: [
        { OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }] },
        { OR: [{ pauseUntil: null }, { pauseUntil: { lte: now } }] },
      ],
    };
    const run = await this.db.seoAuditRun.findFirst({
      where: available,
      orderBy: { createdAt: 'asc' },
    });
    if (!run) return;
    const leaseToken = randomUUID();
    const claim = await this.db.seoAuditRun.updateMany({
      where: { id: run.id, ...available },
      data: { leaseToken, leaseUntil: new Date(now.getTime() + LEASE_MS) },
    });
    if (!claim.count) return;

    const crawl = createAuditCrawler(origin);
    try {
      const checks = await this.db.seoAuditCheck.findMany({
        where: { runId: run.id, checkedAt: null, nextAttemptAt: { lte: now } },
        orderBy: [{ priority: 'asc' }, { path: 'asc' }],
        take: BATCH_SIZE,
      });
      for (const check of checks) {
        if (
          check.source !== 'SITEMAP_FILE' &&
          !run.sitemapChecked &&
          (await this.db.seoAuditCheck.count({
            where: { runId: run.id, path: '/sitemap.xml', checkedAt: null },
          }))
        )
          break;
        const read = await crawl(check.path, check.source === 'SITEMAP_FILE');
        const productStock =
          check.productId && [404, 410].includes(read.observation.status ?? 0)
            ? await readAuditedProductStock(this.db, check.productId)
            : null;
        const recorded = await this.record(run, leaseToken, check, read, productStock);
        if (!recorded) return;
        if (read.observation.status === 429 || read.observation.status === 503) break;
      }
      await this.finish(run, leaseToken);
    } finally {
      await this.db.seoAuditRun.updateMany({
        where: { id: run.id, leaseToken },
        data: { leaseToken: null, leaseUntil: null },
      });
    }
  }

  private async record(
    run: SeoAuditRun,
    leaseToken: string,
    check: SeoAuditCheck,
    read: Awaited<ReturnType<ReturnType<typeof createAuditCrawler>>>,
    productStock: boolean | null,
  ) {
    const { observation, sitemapPaths } = read;
    const now = new Date();
    if (
      check.source === 'SITEMAP_FILE' &&
      sitemapPaths === null &&
      !observation.failure &&
      observation.status === 200
    ) {
      observation.failure = 'SITEMAP_FORMAT';
    }

    return this.db.$transaction(async (tx) => {
      const claim = await tx.seoAuditRun.updateMany({
        where: { id: run.id, leaseToken, leaseUntil: { gt: now } },
        data: {
          leaseUntil: new Date(now.getTime() + LEASE_MS),
          ...([429, 503].includes(observation.status ?? 0)
            ? { pauseUntil: new Date(now.getTime() + 60_000) }
            : {}),
        },
      });
      if (!claim.count) return false;
      const attempts = check.attempts + 1;
      const key = { runId_path: { runId: run.id, path: check.path } };
      if (retryable(observation) && attempts < RETRIES) {
        await tx.seoAuditCheck.update({
          where: key,
          data: {
            attempts,
            observation,
            nextAttemptAt: new Date(now.getTime() + attempts * 60_000),
          },
        });
        return true;
      }
      if (sitemapPaths) {
        const known = new Set(
          (
            await tx.seoAuditCheck.findMany({
              where: { runId: run.id },
              select: { path: true },
            })
          ).map(({ path }) => path),
        );
        const sample = sitemapPaths.filter((path) => !known.has(path)).slice(0, 6);
        await this.discover(
          tx,
          run.id,
          sample.map((path) => ({ path, priority: 18, source: 'SITEMAP' })),
        );
        // Keep all sitemap membership short term so newly discovered links can be compared too.
        await tx.seoAuditRun.update({
          where: { id: run.id },
          data: { sitemapPaths, sitemapChecked: true },
        });
        run.sitemapPaths = sitemapPaths;
        run.sitemapChecked = true;
      }
      const inSitemap =
        run.sitemapChecked && check.source !== 'SITEMAP_FILE'
          ? run.sitemapPaths.includes(check.path)
          : null;
      const previous = await this.previousIssues(tx, run, check.path);
      const issues = evaluateAudit(
        {
          origin: run.origin,
          path: check.path,
          source: check.source,
          sourcePath: check.sourcePath,
          expectedCanonical: check.expectedCanonical,
          mustNoIndex:
            ['FESTIVAL', 'CATALOG_VARIANT'].includes(check.source) ||
            Boolean(
              check.source === 'PAGINATION' &&
              check.sourcePath &&
              (
                await tx.seoAuditCheck.findUnique({
                  where: { runId_path: { runId: run.id, path: check.sourcePath } },
                  select: { source: true },
                })
              )?.source === 'FESTIVAL',
            ),
          productStock,
          inSitemap: inSitemap === true,
        },
        observation,
      ).map((issue): AuditIssue => ({
        ...issue,
        state: previous.has(issue.code) ? 'EXISTING' : 'NEW',
      }));
      await tx.seoAuditCheck.update({
        where: key,
        data: { attempts, checkedAt: now, inSitemap, observation, issues },
      });
      if (!observation.failure && observation.html && !observation.redirects.length) {
        await this.discoverLinks(tx, run.id, check, observation.links);
      }
      return true;
    });
  }

  private async discoverLinks(
    tx: Prisma.TransactionClient,
    runId: string,
    check: SeoAuditCheck,
    links: string[],
  ) {
    const ownPage = check.path.split('?')[0];
    const candidates = links
      .filter((path) => path.startsWith(`${ownPage}?page=`))
      .slice(0, 2)
      .map((path) => ({
        path,
        priority: 13,
        source: 'PAGINATION',
        sourcePath: check.path,
        expectedCanonical: path.endsWith('?page=1') ? ownPage : path,
      }));
    if (!['LINK', 'PAGINATION', 'CATALOG_VARIANT'].includes(check.source)) {
      const products = links.filter((path) => path.startsWith('/products/')).slice(0, 3);
      const other = links
        .filter((path) => /^\/(categories|brands|guide|campaigns)\/[^?]+$/.test(path))
        .slice(0, 2);
      for (const path of [...products, ...other]) {
        candidates.push({
          path,
          priority: 17,
          source: 'LINK',
          sourcePath: check.path,
          expectedCanonical: path,
        });
      }
    }
    if (!candidates.length) return;
    await this.discover(
      tx,
      runId,
      candidates.map((entry) =>
        entry.source === 'LINK'
          ? {
              path: entry.path,
              priority: entry.priority,
              source: entry.source,
              sourcePath: entry.sourcePath,
            }
          : entry,
      ),
    );
    for (const { path } of candidates) {
      await tx.seoAuditCheck.updateMany({
        where: { runId, path, sourcePath: null, checkedAt: null },
        data: { sourcePath: check.path },
      });
    }
  }

  private async discover(tx: Prisma.TransactionClient, runId: string, candidates: AuditSeed[]) {
    if (!candidates.length) return;
    const known = new Set(
      (
        await tx.seoAuditCheck.findMany({
          where: { runId },
          select: { path: true },
        })
      ).map(({ path }) => path),
    );
    if (known.size >= AUDIT_MAX_TARGETS) return;
    const next = candidates
      .filter(({ path }) => !known.has(path))
      .filter(
        ({ source }, index) => source !== 'LINK' || known.size + index < AUDIT_MAX_TARGETS - 4,
      )
      .slice(0, AUDIT_MAX_TARGETS - known.size);
    if (next.length)
      await tx.seoAuditCheck.createMany({
        data: next.map((entry) => ({ ...entry, runId })),
        skipDuplicates: true,
      });
  }

  private async previousIssues(tx: Prisma.TransactionClient, run: SeoAuditRun, path: string) {
    const rows = await tx.seoAuditCheck.findMany({
      where: {
        path,
        runId: { not: run.id },
        run: { origin: run.origin, ruleVersion: run.ruleVersion, finishedAt: { not: null } },
        checkedAt: { not: null },
      },
      orderBy: { checkedAt: 'desc' },
      take: 5,
    });
    const previous = rows[0];
    const verified = rows.find((row) => !readObservation(row)?.failure);
    return new Set([
      ...(previous ? readIssues(previous).map(({ code }) => code) : []),
      ...(verified && verified !== previous ? readIssues(verified).map(({ code }) => code) : []),
    ]);
  }

  private async finish(run: SeoAuditRun, leaseToken: string) {
    await this.db.$transaction(
      async (tx) => {
        if (await tx.seoAuditCheck.count({ where: { runId: run.id, checkedAt: null } })) return;
        const claim = await tx.seoAuditRun.updateMany({
          where: { id: run.id, leaseToken, leaseUntil: { gt: new Date() } },
          data: { finishedAt: new Date(), sitemapPaths: [], pauseUntil: null },
        });
        if (!claim.count) return;
        const checks = await tx.seoAuditCheck.findMany({ where: { runId: run.id } });
        const byPath = new Map(checks.map((check) => [check.path, readObservation(check)]));
        const paths = new Map<string, string[]>();
        const linkedFrom = new Map<string, string>();
        for (const [path, observation] of byPath) {
          if (observation?.html && !observation.failure && !observation.redirects.length) {
            for (const link of observation.links) {
              if (byPath.has(link) && !linkedFrom.has(link)) linkedFrom.set(link, path);
            }
          }
          const key =
            observation && !observation.redirects.length && !path.includes('?')
              ? auditMetadataKey(observation)
              : null;
          if (!key) continue;
          paths.set(key, [...(paths.get(key) ?? []), path]);
        }
        const similarity = new Map(
          [...paths.values()]
            .filter((group) => group.length > 1)
            .flatMap((group) =>
              group.map(
                (path) => [path, group.filter((other) => other !== path).slice(0, 4)] as const,
              ),
            ),
        );
        const depth = new Map([['/', 0]]);
        const pending = ['/'];
        for (const path of pending) {
          const observation = byPath.get(path);
          if (!observation?.html || observation.failure || observation.redirects.length) continue;
          for (const link of observation.links) {
            if (!depth.has(link)) {
              depth.set(link, (depth.get(path) ?? 0) + 1);
              if (byPath.has(link)) pending.push(link);
            }
          }
        }
        for (const check of checks) {
          const matched = similarity.get(check.path);
          const observation = byPath.get(check.path);
          const findings: AuditFinding[] = [];
          const previousIssues = readIssues(check);
          const sourcePath = linkedFrom.get(check.path);
          if (
            sourcePath &&
            observation &&
            !observation.failure &&
            (observation.status === 404 || observation.status === 410) &&
            !previousIssues.some(({ code }) => code === 'BROKEN_INTERNAL_LINK')
          ) {
            findings.push({
              code: 'BROKEN_INTERNAL_LINK',
              severity: 'ERROR',
              evidence: [sourcePath, `HTTP ${observation.status} · ${observation.finalPath}`],
            });
          }
          if (matched)
            findings.push({
              code: 'SIMILAR_METADATA',
              severity: 'REVIEW',
              evidence: matched,
            });
          if (
            check.source === 'PRODUCT' &&
            observation?.html &&
            !observation.redirects.length &&
            byPath.get('/')?.html &&
            byPath.get('/products')?.html
          ) {
            const distance = depth.get(check.path);
            if (distance === undefined || distance > 3)
              findings.push({
                code: 'PRODUCT_DEPTH_SAMPLE',
                severity: 'REVIEW',
                evidence: [
                  distance === undefined
                    ? 'No observed path in sampled links'
                    : `Shortest observed HTML path: ${distance} links`,
                ],
              });
          }
          if (!findings.length) continue;
          const previous = await this.previousIssues(tx, run, check.path);
          const issues: AuditIssue[] = findings.map((item) => ({
            ...item,
            state: previous.has(item.code) ? 'EXISTING' : 'NEW',
          }));
          await tx.seoAuditCheck.update({
            where: { runId_path: { runId: run.id, path: check.path } },
            data: { issues: [...previousIssues, ...issues] },
          });
        }
      },
      { timeout: 15_000 },
    );
  }
}
