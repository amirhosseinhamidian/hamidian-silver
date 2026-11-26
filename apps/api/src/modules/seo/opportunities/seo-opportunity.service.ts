import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Prisma,
  type SeoCorrectionTask,
  type SeoOpportunity,
} from '../../../generated/prisma/client';
import type { SeoOpportunityStatus } from '../../../generated/prisma/enums';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { auditOrigin } from '../audit/seo-audit-crawl';
import { coverageDate } from '../inspection/seo-coverage-import';
import {
  SEARCH_CONSOLE_CLIENT,
  type SearchConsoleClient,
} from '../search-console/google-search-console.client';
import { measureOpportunityImpact, type OpportunityImpact } from './seo-opportunity-impact';
import {
  opportunityRules,
  proposeSeoOpportunities,
  type OpportunityEvidence,
  type OpportunityProposal,
} from './seo-opportunity-rules';
import {
  isCurrentOpportunityUrl,
  opportunityDay,
  readOpportunitySubjects,
  type OpportunityScope,
} from './seo-opportunity-sources';

export const opportunityActions = [
  'APPROVE',
  'REJECT',
  'DEFER',
  'CREATE_TASK',
  'REOPEN',
  'IMPLEMENT',
  'MEASURE',
] as const;
export type OpportunityAction = (typeof opportunityActions)[number];
export type OpportunityUpdate = {
  action: OpportunityAction;
  revision: number;
  note?: string;
  date?: string;
  windowDays?: number;
  confounders?: string;
};

const pageSize = 25;

function proposalKey(
  scope: OpportunityScope,
  item: Pick<OpportunityProposal, 'entityKind' | 'entityId' | 'rule'>,
) {
  return createHash('sha256')
    .update(
      JSON.stringify([scope.property, scope.origin, item.entityKind, item.entityId, item.rule]),
    )
    .digest('hex');
}

function itemDto(item: SeoOpportunity) {
  return {
    id: item.id,
    entityKind: item.entityKind,
    entityId: item.entityId,
    rule: item.rule,
    title: item.title,
    url: item.url,
    score: item.score,
    scoreVersion: item.scoreVersion,
    active: item.active,
    status: item.status,
    revision: item.revision,
    refreshedAt: item.refreshedAt.toISOString(),
    deferredUntil: item.deferredUntil ? opportunityDay(item.deferredUntil) : null,
    evidence: item.evidence as OpportunityEvidence,
  };
}

function taskDto(task: SeoCorrectionTask | null) {
  if (!task) return null;
  return {
    id: task.id,
    instruction: task.instruction,
    url: task.url,
    createdAt: task.createdAt.toISOString(),
    implementedOn: task.implementedOn ? opportunityDay(task.implementedOn) : null,
    windowDays: task.windowDays,
    changeNote: task.changeNote,
    confounders: task.confounders,
    impact: task.impact as OpportunityImpact | null,
  };
}

function decisionStatus(
  item: SeoOpportunity,
  action: OpportunityAction,
): SeoOpportunityStatus | null {
  if (action === 'REOPEN')
    return item.status === 'DEFERRED' || item.status === 'REJECTED' ? 'PENDING' : null;
  if (item.status === 'TASK_CREATED' || item.status === 'REJECTED') return null;
  if (action === 'REJECT') return 'REJECTED';
  if (action === 'DEFER') return 'DEFERRED';
  if (!item.active) return null;
  if (action === 'APPROVE') return item.status !== 'APPROVED' ? 'APPROVED' : null;
  if (action === 'CREATE_TASK') return 'TASK_CREATED';
  return null;
}

@Injectable()
export class SeoOpportunityService {
  private readonly scope: OpportunityScope | null;

  constructor(
    private readonly db: PrismaService,
    config: ConfigService,
    @Inject(SEARCH_CONSOLE_CLIENT) google: Pick<SearchConsoleClient, 'property'>,
  ) {
    const origin = auditOrigin(config.get<string>('STOREFRONT_PUBLIC_ORIGIN'));
    this.scope = origin && google.property ? { origin, property: google.property } : null;
  }

  async refresh(now = new Date()) {
    if (!this.scope)
      throw new ServiceUnavailableException('SEO opportunity origin or property is unavailable.');
    const scope = this.scope;
    const { subjects, canRefresh } = await readOpportunitySubjects(this.db, scope, now);
    if (!canRefresh) return { changed: 0, hasSource: false };
    const unique = new Map<string, OpportunityProposal>();
    for (const proposal of subjects.flatMap(proposeSeoOpportunities)) {
      const key = proposalKey(scope, proposal);
      if (!unique.has(key)) unique.set(key, proposal);
    }
    const absent = subjects
      .flatMap((item) => opportunityRules.map((rule) => proposalKey(scope, { ...item, rule })))
      .filter((key) => !unique.has(key));
    const rows = [...unique.values()]
      .sort(
        (left, right) =>
          right.score - left.score ||
          (left.entityId < right.entityId
            ? -1
            : left.entityId > right.entityId
              ? 1
              : left.rule < right.rule
                ? -1
                : left.rule > right.rule
                  ? 1
                  : 0),
      )
      .slice(0, 200)
      .map((proposal) => ({ ...scope, ...proposal, key: proposalKey(scope, proposal) }));
    return this.db.$transaction(
      async (tx) => {
        const [lock] = await tx.$queryRaw<{ acquired: boolean }[]>`
        SELECT pg_try_advisory_xact_lock(17029, hashtext(${scope.origin + ':' + scope.property})) AS acquired
      `;
        if (!lock?.acquired) return { changed: 0, hasSource: true };
        const changed = rows.length
          ? await tx.$executeRaw`
        INSERT INTO seo_opportunities
          ("key", property, origin, "entityKind", "entityId", rule, title, url, score, "scoreVersion", evidence, "refreshedAt")
        SELECT "key", property, origin, "entityKind", "entityId", rule, title, url, score, "scoreVersion", evidence, ${now}
        FROM jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) AS r(
          "key" char(64), property text, origin text, "entityKind" text, "entityId" uuid, rule text,
          title text, url text, score integer, "scoreVersion" integer, evidence jsonb
        )
        ON CONFLICT ("key") DO UPDATE SET
          title = EXCLUDED.title, url = EXCLUDED.url, score = EXCLUDED.score, "scoreVersion" = EXCLUDED."scoreVersion",
          active = true, revision = seo_opportunities.revision + 1,
          evidence = EXCLUDED.evidence, "refreshedAt" = EXCLUDED."refreshedAt"
        WHERE seo_opportunities."refreshedAt" <= EXCLUDED."refreshedAt" AND (
          NOT seo_opportunities.active OR seo_opportunities.evidence IS DISTINCT FROM EXCLUDED.evidence
          OR seo_opportunities.url IS DISTINCT FROM EXCLUDED.url OR seo_opportunities.title IS DISTINCT FROM EXCLUDED.title
          OR seo_opportunities.score IS DISTINCT FROM EXCLUDED.score OR seo_opportunities."scoreVersion" IS DISTINCT FROM EXCLUDED."scoreVersion"
        )
      `
          : 0;
        const retired = absent.length
          ? await tx.seoOpportunity.updateMany({
              where: { key: { in: absent }, active: true, refreshedAt: { lte: now } },
              data: { active: false, refreshedAt: now, revision: { increment: 1 } },
            })
          : { count: 0 };
        const ready = rows.length
          ? await tx.seoOpportunity.updateManyAndReturn({
              where: {
                key: { in: rows.map(({ key }) => key) },
                active: true,
                status: 'DEFERRED',
                deferredUntil: { lte: new Date(opportunityDay(now)) },
              },
              data: { status: 'PENDING', deferredUntil: null, revision: { increment: 1 } },
              select: { id: true },
            })
          : [];
        if (ready.length)
          await tx.seoOpportunityEvent.createMany({
            data: ready.map(({ id }) => ({
              opportunityId: id,
              action: 'REOPEN',
              note: 'بازهٔ تعویق پایان یافت.',
            })),
          });
        return { changed: changed + retired.count + ready.length, hasSource: true };
      },
      { timeout: 12_000 },
    );
  }

  async list(page: number, status: SeoOpportunityStatus = 'PENDING') {
    const empty = { configured: Boolean(this.scope), page, pageSize, total: 0, items: [] };
    if (!this.scope) return empty;
    const where = { ...this.scope, status, ...(status === 'PENDING' ? { active: true } : {}) };
    const [items, total] = await Promise.all([
      this.db.seoOpportunity.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [{ active: 'desc' }, { score: 'desc' }, { id: 'asc' }],
      }),
      this.db.seoOpportunity.count({ where }),
    ]);
    return { ...empty, total, items: items.map(itemDto) };
  }

  async detail(id: string, page = 1) {
    if (!this.scope) throw new NotFoundException('SEO opportunity not found.');
    const [item, eventCount] = await Promise.all([
      this.db.seoOpportunity.findFirst({
        where: { ...this.scope, id },
        include: {
          task: true,
          events: {
            skip: (page - 1) * pageSize,
            take: pageSize,
            orderBy: [{ recordedAt: 'desc' }, { id: 'desc' }],
            include: { actor: { select: { firstName: true, lastName: true } } },
          },
        },
      }),
      this.db.seoOpportunityEvent.count({ where: { opportunityId: id, opportunity: this.scope } }),
    ]);
    if (!item) throw new NotFoundException('SEO opportunity not found.');
    return {
      item: itemDto(item),
      task: taskDto(item.task),
      page,
      pageSize,
      eventCount,
      history: item.events.map((event) => ({
        id: event.id,
        action: event.action,
        at: event.recordedAt.toISOString(),
        note: event.note,
        actor: event.actor
          ? [event.actor.firstName, event.actor.lastName].filter(Boolean).join(' ') || 'مدیر'
          : null,
      })),
    };
  }

  async update(id: string, actorId: string, input: OpportunityUpdate, now = new Date()) {
    if (!this.scope) throw new NotFoundException('SEO opportunity not found.');
    const current = await this.db.seoOpportunity.findFirst({
      where: { ...this.scope, id },
      include: { task: true },
    });
    if (!current) throw new NotFoundException('SEO opportunity not found.');
    if (current.revision !== input.revision)
      throw new ConflictException('SEO opportunity has changed.');
    const date = input.date ? coverageDate(input.date) : null;
    const note = input.note?.trim() || null;
    const today = opportunityDay(now);
    const confounders = input.confounders?.trim() || null;
    const status = decisionStatus(current, input.action);
    if (
      ['APPROVE', 'CREATE_TASK'].includes(input.action) &&
      !(await isCurrentOpportunityUrl(
        this.db,
        this.scope,
        current.entityKind,
        current.entityId,
        current.url,
      ))
    ) {
      throw new ConflictException('The canonical opportunity URL is no longer published.');
    }
    const task = current.task;
    let impact: OpportunityImpact | null = null;
    let windowDays: number | undefined;
    if (input.action === 'IMPLEMENT') {
      windowDays = input.windowDays ?? 14;
      if (
        !task ||
        !date ||
        date < opportunityDay(task.createdAt) ||
        date > today ||
        !note ||
        ![7, 14, 28].includes(windowDays)
      ) {
        throw new BadRequestException(
          'A correction task, implementation date, window and change note are required.',
        );
      }
    } else if (input.action === 'MEASURE') {
      if (!task?.implementedOn || !task.windowDays) {
        throw new BadRequestException('Record the implementation before measuring impact.');
      }
      impact = await measureOpportunityImpact(
        this.db,
        this.scope,
        task.url,
        opportunityDay(task.implementedOn),
        task.windowDays,
      );
      if (isDeepStrictEqual(impact, task.impact)) return this.detail(id);
    } else if (!status || (input.action === 'DEFER' && (!date || date <= today))) {
      throw new BadRequestException('This SEO opportunity action is unavailable.');
    }

    await this.db.$transaction(async (tx) => {
      const changed = await tx.seoOpportunity.updateMany({
        where: { id, revision: input.revision },
        data: {
          revision: { increment: 1 },
          ...(status
            ? {
                status,
                deferredUntil: input.action === 'DEFER' && date ? new Date(date) : null,
              }
            : {}),
        },
      });
      if (!changed.count) throw new ConflictException('SEO opportunity has changed.');
      if (input.action === 'CREATE_TASK') {
        const evidence = current.evidence as OpportunityEvidence;
        await tx.seoCorrectionTask.create({
          data: { opportunityId: id, instruction: evidence.recommendation, url: current.url },
        });
      }
      if (input.action === 'IMPLEMENT' && task && date && windowDays) {
        await tx.seoCorrectionTask.update({
          where: { id: task.id },
          data: {
            implementedOn: new Date(date),
            windowDays,
            changeNote: note,
            confounders,
            impact: Prisma.DbNull,
          },
        });
      }
      if (task && impact)
        await tx.seoCorrectionTask.update({ where: { id: task.id }, data: { impact } });
      const snapshot =
        impact ??
        (status
          ? { score: current.score, scoreVersion: current.scoreVersion, evidence: current.evidence }
          : { implementedOn: date, windowDays: windowDays ?? null, confounders });
      await tx.seoOpportunityEvent.create({
        data: { opportunityId: id, actorId, action: input.action, note, snapshot },
      });
    });
    return this.detail(id);
  }
}
