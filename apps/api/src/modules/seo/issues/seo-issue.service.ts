import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import type { Prisma, SeoIssue } from '../../../generated/prisma/client';
import type { SeoIssueStatus } from '../../../generated/prisma/enums';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { PERMISSION_CODES, ROLE_CODES } from '../../authorization/rbac.constants';
import { auditOrigin } from '../audit/seo-audit-crawl';
import {
  SEARCH_CONSOLE_CLIENT,
  type SearchConsoleClient,
} from '../search-console/google-search-console.client';
import { type IssueEvidence, type IssueScope, type IssueSignal } from './seo-issue-signals';
import { readIssueSignals } from './seo-issue-sources';
import { issueTransition } from './seo-issue-transitions';

const pageSize = 25;
const staffSelect = { id: true, firstName: true, lastName: true } as const;
export function seoStaff(permission: string): Prisma.UserWhereInput {
  return {
    isActive: true,
    deletedAt: null,
    roles: {
      some: {
        role: {
          code: { in: [ROLE_CODES.ADMIN, ROLE_CODES.MANAGER] },
          isActive: true,
          deletedAt: null,
          permissions: { some: { permission: { code: permission } } },
        },
      },
    },
  };
}

function formatStaff(
  user: { id: string; firstName: string | null; lastName: string | null } | null,
) {
  return (
    user && {
      id: user.id,
      name: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.id.slice(0, 8),
    }
  );
}

function summarize(issue: SeoIssue & { owner: Parameters<typeof formatStaff>[0] }) {
  return {
    id: issue.id,
    rule: issue.rule,
    subject: issue.subject,
    severity: issue.severity,
    status: issue.status,
    active: issue.active,
    revision: issue.revision,
    observedAt: issue.observedAt.toISOString(),
    firstObservedAt: issue.firstObservedAt.toISOString(),
    evidence: issue.evidence as IssueEvidence,
    owner: formatStaff(issue.owner),
  };
}

type UpdateIssue = {
  revision: number;
  status?: SeoIssueStatus;
  ownerId?: string | null;
  note?: string;
};
export function seoIssueKey(scope: IssueScope, signal: Pick<IssueSignal, 'rule' | 'subject'>) {
  return createHash('sha256')
    .update(JSON.stringify([scope.property, scope.origin, signal.rule, signal.subject]))
    .digest('hex');
}

@Injectable()
export class SeoIssueService {
  readonly scope: IssueScope | null;

  constructor(
    private readonly db: PrismaService,
    private readonly config: ConfigService,
    @Inject(SEARCH_CONSOLE_CLIENT) google: Pick<SearchConsoleClient, 'property'>,
  ) {
    const origin = auditOrigin(config.get<string>('STOREFRONT_PUBLIC_ORIGIN'));
    this.scope = origin && google.property ? { origin, property: google.property } : null;
  }

  @Cron('0 */10 * * * *', { name: 'seo-issue-scan', waitForCompletion: true })
  async tick() {
    if (this.scope && this.config.get<boolean>('SEO_ISSUES_ENABLED')) await this.scan();
  }

  async scan(now = new Date()) {
    if (!this.scope)
      throw new ServiceUnavailableException('SEO issue origin or property is unavailable.');
    const signals = await readIssueSignals(this.db, this.scope, now, {
      days: this.config.get<number>('SEO_ISSUES_COMPARISON_DAYS') ?? 7,
      impressions: this.config.get<number>('SEO_ISSUES_MIN_IMPRESSIONS') ?? 400,
      clicks: this.config.get<number>('SEO_ISSUES_MIN_CLICKS') ?? 30,
      percent: this.config.get<number>('SEO_ISSUES_DROP_PERCENT') ?? 40,
    });
    return { changed: await this.applySignals(this.scope, signals, now) };
  }

  async applySignals(scope: IssueScope, signals: IssueSignal[], now: Date) {
    if (!signals.length) return 0;
    const keys = new Map(signals.map((signal) => [seoIssueKey(scope, signal), signal]));
    const rows = await this.db.seoIssue.findMany({
      where: { issueKey: { in: [...keys.keys()] } },
      select: {
        issueKey: true,
        status: true,
        severity: true,
        active: true,
        observedAt: true,
        lastQueuedAt: true,
      },
    });
    const known = new Map(rows.map((row) => [row.issueKey, row]));
    const candidates = [...keys]
      .filter(([key, signal]) => issueTransition(known.get(key), signal, now))
      .slice(0, 120);
    if (!candidates.length) return 0;
    const recipients = this.config.get<boolean>('SEO_ISSUES_TELEGRAM_ENABLED')
      ? await this.db.adminMessageRecipient.findMany({
          where: { telegramChatId: { not: null }, user: seoStaff(PERMISSION_CODES.SETTINGS_READ) },
          select: { userId: true },
          take: 30,
          orderBy: { userId: 'asc' },
        })
      : [];
    let events = 0;
    for (let cursor = 0; cursor < candidates.length; cursor += 20) {
      events += await this.db.$transaction(
        async (tx) => {
          const [lock] = await tx.$queryRaw<{ acquired: boolean }[]>`
          SELECT pg_try_advisory_xact_lock(17028, hashtext(${scope.origin + ':' + scope.property})) AS acquired
        `;
          if (!lock?.acquired) return 0;
          let count = 0;
          for (const [issueKey, signal] of candidates.slice(cursor, cursor + 20)) {
            const previous = await tx.seoIssue.findUnique({ where: { issueKey } });
            const transition = issueTransition(previous ?? undefined, signal, now);
            if (!transition) continue;
            const notification = transition.notify && recipients.length > 0;
            const fields = {
              observedAt: signal.observedAt,
              active: signal.active,
              ...(signal.active
                ? { severity: signal.evidence.severity, evidence: signal.evidence }
                : {}),
              ...(notification ? { lastQueuedAt: now } : {}),
            };
            let id: string;
            if (previous) {
              const result = await tx.seoIssue.updateMany({
                where: { id: previous.id, revision: previous.revision },
                data: {
                  ...fields,
                  status: transition.status,
                  ...(transition.kind ? { revision: { increment: 1 } } : {}),
                },
              });
              if (!result.count) continue;
              id = previous.id;
            } else {
              const issue = await tx.seoIssue.create({
                data: {
                  ...scope,
                  issueKey,
                  rule: signal.rule,
                  subject: signal.subject,
                  ...fields,
                  severity: signal.evidence.severity,
                  evidence: signal.evidence,
                  firstObservedAt: signal.observedAt,
                },
                select: { id: true },
              });
              id = issue.id;
            }
            if (transition.kind) {
              await tx.seoIssueEvent.create({
                data: {
                  issueId: id,
                  kind: transition.kind,
                  evidence: signal.evidence,
                  ...(notification
                    ? {
                        deliveries: {
                          createMany: {
                            data: recipients.map(({ userId }) => ({ recipientId: userId })),
                          },
                        },
                      }
                    : {}),
                },
              });
              count++;
            }
          }
          return count;
        },
        { timeout: 15_000 },
      );
    }
    return events;
  }

  async list(page: number, status?: SeoIssueStatus) {
    const empty = { configured: Boolean(this.scope), page, pageSize, total: 0, items: [] };
    if (!this.scope) return empty;
    const where = { ...this.scope, ...(status ? { status } : {}) };
    const [issues, total] = await Promise.all([
      this.db.seoIssue.findMany({
        where,
        include: { owner: { select: staffSelect } },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [{ status: 'asc' }, { severity: 'desc' }, { observedAt: 'desc' }, { id: 'desc' }],
      }),
      this.db.seoIssue.count({ where }),
    ]);
    return { ...empty, total, items: issues.map(summarize) };
  }

  async detail(id: string, page = 1) {
    if (!this.scope) throw new NotFoundException('SEO issue not found.');
    const [issue, staff, eventCount] = await Promise.all([
      this.db.seoIssue.findFirst({
        where: { ...this.scope, id },
        include: {
          owner: { select: staffSelect },
          events: {
            include: { actor: { select: staffSelect }, deliveries: { select: { status: true } } },
            skip: (page - 1) * pageSize,
            take: pageSize,
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          },
        },
      }),
      this.db.user.findMany({
        where: seoStaff(PERMISSION_CODES.SETTINGS_WRITE),
        select: staffSelect,
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }, { id: 'asc' }],
        take: 100,
      }),
      this.db.seoIssueEvent.count({ where: { issueId: id, issue: this.scope } }),
    ]);
    if (!issue) throw new NotFoundException('SEO issue not found.');
    return {
      issue: summarize(issue),
      owners: staff.map((user) => ({ id: user.id, name: formatStaff(user)?.name ?? user.id })),
      page,
      pageSize,
      eventCount,
      events: issue.events.map((event) => ({
        id: event.id,
        kind: event.kind,
        note: event.note,
        actor: formatStaff(event.actor),
        at: event.createdAt.toISOString(),
        evidence: event.evidence as IssueEvidence | null,
        deliveryStates: event.deliveries.map(({ status }) => status),
      })),
    };
  }

  async update(id: string, actorId: string, input: UpdateIssue) {
    if (!this.scope) throw new NotFoundException('SEO issue not found.');
    const scope = this.scope;
    await this.db.$transaction(async (tx) => {
      const current = await tx.seoIssue.findFirst({ where: { ...scope, id } });
      if (!current) throw new NotFoundException('SEO issue not found.');
      if (current.revision !== input.revision)
        throw new ConflictException('The SEO issue was updated.');
      const note = input.note?.trim() || null;
      const changeStatus = input.status !== undefined && input.status !== current.status;
      const changeOwner = input.ownerId !== undefined && input.ownerId !== current.ownerId;
      if (!changeStatus && !changeOwner && !note) return;
      const owner =
        changeOwner && input.ownerId
          ? await tx.user.findFirst({
              where: { id: input.ownerId, ...seoStaff(PERMISSION_CODES.SETTINGS_WRITE) },
              select: staffSelect,
            })
          : null;
      if (changeOwner && input.ownerId && !owner)
        throw new BadRequestException('SEO assignee is not available.');
      const change = await tx.seoIssue.updateMany({
        where: { id, revision: input.revision },
        data: {
          revision: { increment: 1 },
          ...(changeStatus ? { status: input.status } : {}),
          ...(changeOwner ? { ownerId: input.ownerId } : {}),
        },
      });
      if (!change.count) throw new ConflictException('The SEO issue was updated.');
      const facts = [
        ...(changeStatus ? [`وضعیت ${current.status} → ${input.status}`] : []),
        ...(changeOwner ? [`مسئول ${formatStaff(owner)?.name ?? 'بدون مسئول'}`] : []),
      ];
      await tx.seoIssueEvent.create({
        data: {
          issueId: id,
          actorId,
          kind: changeOwner || changeStatus ? 'UPDATED' : 'NOTE',
          note,
          evidence: { ...(current.evidence as IssueEvidence), facts },
        },
      });
    });
    return this.detail(id);
  }
}
