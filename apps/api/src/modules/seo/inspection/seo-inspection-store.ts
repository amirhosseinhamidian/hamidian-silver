import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { Prisma, SeoInspectionTarget } from '../../../generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { SearchConsoleError } from '../search-console/search-console-errors';
import type { InspectionCandidate } from './seo-index-candidates';
import type { GoogleIndex } from './seo-index-observation';

const dayMs = 86_400_000;
const maxAttempts = 3;
export const inspectionDay = (now: Date) => new Date(Math.floor(now.getTime() / dayMs) * dayMs);

type Scope = { property: string; origin: string };
type Claim = { target: SeoInspectionTarget; token: string; attempt: number };
type Result = { observation: GoogleIndex } | { failure: SearchConsoleError };

async function takeLock(tx: Prisma.TransactionClient, property: string) {
  const [lock] = await tx.$queryRaw<{ acquired: boolean }[]>`
    SELECT pg_try_advisory_xact_lock(17027, hashtext(${property})) AS acquired
  `;
  return lock?.acquired === true;
}

@Injectable()
export class SeoInspectionStore {
  constructor(private readonly db: PrismaService) {}

  async plan(scope: Scope, now: Date, candidates: InspectionCandidate[], limit: number) {
    const budgetDay = inspectionDay(now);
    return this.db.$transaction(async (tx) => {
      if (!(await takeLock(tx, scope.property))) return 0;
      const state = await tx.seoInspectionState.upsert({
        where: { property: scope.property },
        create: { property: scope.property, budgetDay },
        update: {},
      });
      if (state.plannedDay?.getTime() === budgetDay.getTime()) return 0;
      const existing = await tx.seoInspectionTarget.findMany({
        where: { ...scope, path: { in: candidates.map(({ path }) => path) } },
        select: { path: true, dueAt: true, queued: true },
      });
      const byPath = new Map(existing.map((item) => [item.path, item]));
      const selected = candidates.filter(({ path }) => {
        const item = byPath.get(path);
        return !item || (!item.queued && item.dueAt <= now);
      });
      const pending = await tx.seoInspectionTarget.count({ where: { ...scope, queued: true } });
      const capacity = Math.max(0, Math.min(18, limit) - pending);
      const groups = ['AUDIT', 'PERFORMANCE', 'CONTENT'].map((kind) =>
        selected.filter(({ source }) => source === kind).slice(0, 6),
      );
      const sample = groups
        .flatMap((group) => group.map((candidate, index) => ({ candidate, index })))
        .sort((first, second) => first.index - second.index)
        .slice(0, capacity)
        .map(({ candidate }) => candidate);
      const newRows = sample.filter(({ path }) => !byPath.has(path));
      if (newRows.length) {
        await tx.seoInspectionTarget.createMany({
          data: newRows.map((candidate) => ({ ...scope, ...candidate, dueAt: now })),
        });
      }
      for (const candidate of sample.filter(({ path }) => byPath.has(path))) {
        await tx.seoInspectionTarget.update({
          where: { property_origin_path: { ...scope, path: candidate.path } },
          data: { ...candidate, dueAt: now, queued: true, attempts: 0 },
        });
      }
      await tx.seoInspectionState.update({
        where: { property: scope.property },
        data: { plannedDay: budgetDay },
      });
      return sample.length;
    });
  }

  async claim(scope: Scope, dailyLimit: number, now: Date): Promise<Claim | null> {
    const budgetDay = inspectionDay(now);
    return this.db.$transaction(async (tx) => {
      if (!(await takeLock(tx, scope.property))) return null;
      const state = await tx.seoInspectionState.findUnique({ where: { property: scope.property } });
      if (
        !state ||
        (state.leaseUntil && state.leaseUntil > now) ||
        (state.pausedUntil && state.pausedUntil > now)
      )
        return null;
      const reset = state.budgetDay.getTime() !== budgetDay.getTime();
      if (!reset && state.used >= dailyLimit) return null;
      const target = await tx.seoInspectionTarget.findFirst({
        where: { ...scope, queued: true, dueAt: { lte: now } },
        orderBy: [{ priority: 'asc' }, { dueAt: 'asc' }, { path: 'asc' }],
      });
      if (!target) return null;
      const token = randomUUID();
      await tx.seoInspectionState.update({
        where: { property: scope.property },
        data: {
          budgetDay,
          used: reset ? 1 : { increment: 1 },
          leaseToken: token,
          leaseUntil: new Date(now.getTime() + 60_000),
          pausedUntil: null,
          pauseReason: null,
        },
      });
      const attempt = target.attempts + 1;
      await tx.seoInspectionTarget.update({
        where: { property_origin_path: { ...scope, path: target.path } },
        data: {
          attempts: attempt,
          lastAttemptAt: now,
          lastError: 'interrupted',
          queued: attempt < maxAttempts,
          dueAt: new Date(now.getTime() + (attempt < maxAttempts ? 5 * 60_000 : 7 * dayMs)),
        },
      });
      return { target, token, attempt };
    });
  }

  async finish(claim: Claim, result: Result, now: Date) {
    const { property, origin, path, priority } = claim.target;
    const failure = 'failure' in result ? result.failure : null;
    const code = failure?.code;
    const providerPause = code === 'quota_exceeded' || code === 'rate_limited';
    const delay = Math.min(
      7 * dayMs,
      Math.max(
        (failure?.retryAfterSeconds ?? 0) * 1000,
        code === 'rate_limited' && failure?.retryAfterSeconds ? 60_000 : dayMs,
      ),
    );
    const renewable =
      code && ['timeout', 'busy', 'upstream_unavailable', 'authentication_failed'].includes(code);
    const retry = providerPause || (Boolean(renewable) && claim.attempt < maxAttempts);
    const nextAttempt = providerPause ? delay : claim.attempt * 15 * 60_000;

    return this.db.$transaction(async (tx) => {
      const updated = await tx.seoInspectionState.updateMany({
        where: { property, leaseToken: claim.token, leaseUntil: { gt: now } },
        data: {
          leaseToken: null,
          leaseUntil: null,
          pausedUntil: providerPause ? new Date(now.getTime() + delay) : null,
          pauseReason: providerPause ? code : null,
        },
      });
      if (!updated.count) return false;
      await tx.seoInspectionTarget.update({
        where: { property_origin_path: { property, origin, path } },
        data: {
          queued: retry,
          lastError: code ?? null,
          attempts: providerPause ? Math.max(0, claim.attempt - 1) : claim.attempt,
          dueAt: new Date(
            now.getTime() + (retry ? nextAttempt : (failure || priority < 3 ? 7 : 30) * dayMs),
          ),
          ...('observation' in result ? { observedAt: now, observation: result.observation } : {}),
        },
      });
      return true;
    });
  }
}
