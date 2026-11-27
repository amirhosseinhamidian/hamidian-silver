import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { randomUUID } from 'node:crypto';
import { lockOrderRowForUpdate } from '../../common/order-row-lock';
import type { Prisma, PurchaseRewardJob } from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { RewardPoliciesService } from '../reward-policies/reward-policies.service';
import { DEFAULT_REWARD_ACTIVATION_DELAY_DAYS } from '../reward-policies/dto/reward-policy.dto';
import {
  isRewardablePurchase,
  purchaseRewardOrderSelect,
  resolvePurchaseRewardBasis,
  type PurchaseRewardOrder,
} from './purchase-reward-basis';
import {
  evaluatePurchaseReward,
  previousPurchases,
  purchaseRewardBudget,
  type RecordedPurchaseReward,
} from './purchase-reward-calculation';
import { WalletCheckoutService } from './wallet-checkout.service';
import { WalletLedgerService } from './wallet-ledger.service';
import { permitsNewGrowthCredit } from './growth-credit-issuance.service';

const batchSize = 12;
const maxAttempts = 8;
const minute = 60_000;
const day = 24 * 60 * minute;
const leaseDuration = 5 * minute;
const deliveryPoll = 60 * minute;
const leaseCleared = { leaseToken: null, leaseUntil: null };

type Claim = Pick<PurchaseRewardJob, 'orderId' | 'attempts'> & {
  leaseToken: string;
  calculated: boolean;
};

@Injectable()
export class PurchaseRewardWorker {
  private readonly logger = new Logger(PurchaseRewardWorker.name);

  constructor(
    private readonly db: PrismaService,
    private readonly policies: RewardPoliciesService,
    private readonly ledger: WalletLedgerService,
    private readonly walletCheckout: WalletCheckoutService,
    private readonly config: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE, { name: 'purchase-reward-jobs', waitForCompletion: true })
  async tick() {
    if (this.config.get<boolean>('PURCHASE_REWARD_WORKER_ENABLED', false) !== true) return;
    try {
      const result = await this.run();
      if (result.claimed || result.deadLetter)
        this.logger.log(`Purchase rewards ${JSON.stringify(result)}`);
    } catch (error) {
      this.logger.error(
        `Purchase reward sweep failed (${error instanceof Error ? error.name : 'UnknownError'}).`,
      );
    }
  }

  async run(now = new Date()) {
    const recovery = await this.db.purchaseRewardJob.updateMany({
      where: { status: 'PROCESSING', attempts: { gte: maxAttempts }, leaseUntil: { lte: now } },
      data: {
        status: 'DEAD_LETTER',
        resultCode: 'LEASE_EXHAUSTED',
        finishedAt: now,
        ...leaseCleared,
      },
    });
    const result = {
      claimed: 0,
      waiting: 0,
      completed: 0,
      skipped: 0,
      retry: 0,
      deadLetter: recovery.count,
      lost: 0,
      paused: 0,
    };
    for (let index = 0; index < batchSize; index += 1) {
      const claim = await this.claim(now);
      if (!claim) break;
      result.claimed += 1;
      try {
        result[await this.process(claim, now)] += 1;
      } catch (error) {
        const attempt = await this.recordFailure(claim, now);
        result[attempt] += 1;
        if (attempt !== 'lost') {
          this.logger.warn(
            `Purchase reward ${claim.orderId} attempt=${claim.attempts} ${attempt} (${error instanceof Error ? error.name : 'UnknownError'}).`,
          );
        }
      }
    }
    return result;
  }

  async metrics(now = new Date()) {
    const [statuses, due, deadLetters] = await Promise.all([
      this.db.purchaseRewardJob.groupBy({ by: ['status'], _count: { _all: true } }),
      this.db.purchaseRewardJob.aggregate({
        where: {
          reviewHeldAt: null,
          status: { in: ['PENDING', 'WAITING'] },
          nextAttemptAt: { lte: now },
        },
        _count: { _all: true },
        _min: { nextAttemptAt: true },
      }),
      this.db.purchaseRewardJob.findMany({
        where: { status: 'DEAD_LETTER' },
        orderBy: [{ finishedAt: 'desc' }, { sequence: 'desc' }],
        take: 20,
        select: { orderId: true, attempts: true, resultCode: true },
      }),
    ]);
    return {
      statuses: statuses.map(({ status, _count }) => ({ status, count: _count._all })),
      due: due._count._all,
      oldestDueAt: due._min.nextAttemptAt?.toISOString() ?? null,
      enabled: this.config.get<boolean>('PURCHASE_REWARD_WORKER_ENABLED', false) === true,
      deadLetters,
    };
  }

  async retryDeadLetter(orderId: string, now = new Date()) {
    const job = await this.db.purchaseRewardJob.findUnique({
      where: { orderId },
      select: { calculation: true, status: true },
    });
    if (job?.status !== 'DEAD_LETTER')
      throw new ConflictException('Only dead-letter reward jobs can be retried.');
    const result = await this.db.purchaseRewardJob.updateMany({
      where: { orderId, status: 'DEAD_LETTER', reviewHeldAt: null },
      data: {
        status: job.calculation ? 'WAITING' : 'PENDING',
        nextAttemptAt: now,
        attempts: 0,
        finishedAt: null,
        resultCode: null,
        ...leaseCleared,
      },
    });
    if (!result.count) throw new ConflictException('The reward job has already changed.');
  }

  async forCustomer(userId: string, page: number) {
    const pageSize = 25;
    const rows = await this.db.purchaseRewardJob.findMany({
      where: { userId },
      orderBy: [{ reviewHeldAt: { sort: 'desc', nulls: 'last' } }, { sequence: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize + 1,
      select: {
        orderId: true,
        status: true,
        attempts: true,
        resultCode: true,
        reviewHeldAt: true,
        nextAttemptAt: true,
        order: { select: { orderNumber: true } },
      },
    });
    return {
      items: rows.slice(0, pageSize).map(({ order, nextAttemptAt, reviewHeldAt, ...job }) => ({
        ...job,
        orderNumber: order.orderNumber,
        nextAttemptAt: nextAttemptAt.toISOString(),
        reviewHeldAt: reviewHeldAt?.toISOString() ?? null,
      })),
      page,
      hasMore: rows.length > pageSize,
    };
  }

  async setReviewHold(orderId: string, hold: boolean, now = new Date()) {
    const result = await this.db.purchaseRewardJob.updateMany({
      where: {
        orderId,
        status: { in: ['PENDING', 'WAITING', 'DEAD_LETTER'] },
        reviewHeldAt: hold ? null : { not: null },
      },
      data: { reviewHeldAt: hold ? now : null },
    });
    if (!result.count) throw new ConflictException('The reward job status or review lock changed.');
  }

  private async claim(now: Date) {
    const token = randomUUID();
    const leaseUntil = new Date(+now + leaseDuration);
    const [job] = await this.db.$queryRaw<Claim[]>`
      WITH candidate AS (
        SELECT due."orderId" FROM "purchase_reward_jobs" due
        WHERE due."reviewHeldAt" IS NULL AND due.attempts < ${maxAttempts} AND (
          (due.status IN ('PENDING', 'WAITING') AND due."nextAttemptAt" <= ${now})
          OR (due.status = 'PROCESSING' AND due."leaseUntil" <= ${now})
        ) AND (due.calculation IS NOT NULL OR EXISTS (
          SELECT 1 FROM "growth_credit_issuance_control" WHERE id = 1 AND mode = 'LIVE'
        )) AND (due.calculation IS NOT NULL OR NOT EXISTS (
          SELECT 1 FROM "purchase_reward_jobs" prior
          WHERE prior."userId" = due."userId" AND prior.sequence < due.sequence
            AND prior.calculation IS NULL AND prior.status IN ('PENDING', 'PROCESSING')
        )
        )
        ORDER BY due."nextAttemptAt", due.sequence
        LIMIT 1 FOR UPDATE SKIP LOCKED
      )
      UPDATE "purchase_reward_jobs" job
      SET status = 'PROCESSING', attempts = job.attempts + 1,
        "leaseToken" = ${token}::uuid, "leaseUntil" = ${leaseUntil}
      FROM candidate WHERE job."orderId" = candidate."orderId"
      RETURNING job."orderId", job.attempts, job."leaseToken", (job.calculation IS NOT NULL) AS calculated
    `;
    return job;
  }

  private async process(claim: Claim, now: Date) {
    return this.db.$transaction(
      async (tx) => {
        await lockOrderRowForUpdate(tx, claim.orderId);
        const [owned] = await tx.$queryRaw<{ orderId: string }[]>`
        SELECT "orderId" FROM "purchase_reward_jobs"
        WHERE "orderId" = ${claim.orderId}::uuid AND "leaseToken" = ${claim.leaseToken}::uuid
        FOR UPDATE
      `;
        if (!owned) return 'lost' as const;
        const job = await tx.purchaseRewardJob.findUniqueOrThrow({
          where: { orderId: claim.orderId },
        });
        if (!job.calculation && !(await permitsNewGrowthCredit(tx, true))) {
          await tx.purchaseRewardJob.update({
            where: { orderId: job.orderId },
            data: { status: 'PENDING', attempts: { decrement: 1 }, ...leaseCleared },
          });
          return 'paused' as const;
        }
        const order = await tx.order.findUniqueOrThrow({
          where: { id: claim.orderId },
          select: purchaseRewardOrderSelect,
        });
        return job.calculation
          ? this.activate(tx, job, order, now)
          : this.calculate(tx, job, order, now);
      },
      { timeout: 15_000 },
    );
  }

  private async calculate(
    tx: Prisma.TransactionClient,
    job: PurchaseRewardJob,
    order: PurchaseRewardOrder,
    now: Date,
  ) {
    if (!isRewardablePurchase(order)) return this.skip(tx, job, 'ORDER_INELIGIBLE', now);
    const { policy } = await this.policies.active(job.paidAt, tx);
    if (!policy?.enabled) return this.skip(tx, job, 'POLICY_DISABLED', now);

    const basis = resolvePurchaseRewardBasis(order);
    if (basis.referralAllowsPurchaseReward === false) {
      return this.skip(tx, job, 'REFERRAL_COMBINATION_EXCLUDED', now);
    }
    const referral = await tx.referralGrantJob.findFirst({
      where: { lotId: { not: null }, attribution: { firstOrderId: order.id } },
      select: { calculation: true },
    });
    const referralRule = referral?.calculation as
      { rule?: { allowPurchaseReward?: boolean } } | undefined;
    if (referralRule?.rule?.allowPurchaseReward === false) {
      return this.skip(tx, job, 'REFERRAL_COMBINATION_EXCLUDED', now);
    }
    const previousCompletedPurchases = await previousPurchases(
      tx,
      order.userId,
      order.id,
      job.sequence,
      job.paidAt,
    );
    const budget = await purchaseRewardBudget(tx, order.userId, order.id, job.paidAt);
    await this.ledger.lockAccount(tx, order.userId);
    const existing = await this.purchaseLot(tx, order.id);
    if (existing) return this.skip(tx, job, 'EXISTING_PURCHASE_CREDIT', now);

    const context = { basis, previousCompletedPurchases, ...budget };
    const applied = evaluatePurchaseReward(policy.version, policy.definition, order, context);
    const amountToman = applied.estimatedRewardToman;
    const activationDelayDays =
      policy.definition.activationDelayDays ?? DEFAULT_REWARD_ACTIVATION_DELAY_DAYS;
    const calculation = {
      ...context,
      ruleCode: applied.grantRuleCode,
      baseToman: applied.rewardBaseToman,
      grantedToman: amountToman,
      activationDelayDays,
    } satisfies RecordedPurchaseReward;
    if (!amountToman) {
      return this.skip(tx, job, 'NO_REWARD', now, { policyVersion: policy.version, calculation });
    }
    await this.ledger.grant(
      {
        userId: order.userId,
        orderId: order.id,
        source: 'PURCHASE',
        sourceKey: order.id,
        policyVersion: policy.version,
        amountToman,
        expiresAt: new Date(+now + applied.expiryDays * day),
        idempotencyKey: `purchase-reward:grant:${order.id}`,
      },
      tx,
    );
    await tx.purchaseRewardJob.update({
      where: { orderId: order.id },
      data: {
        status: 'WAITING',
        nextAttemptAt: this.activationCheck(order, now, activationDelayDays),
        attempts: 0,
        policyVersion: policy.version,
        calculation,
        resultCode: null,
        ...leaseCleared,
      },
    });
    return 'waiting' as const;
  }

  private async activate(
    tx: Prisma.TransactionClient,
    job: PurchaseRewardJob,
    order: PurchaseRewardOrder,
    now: Date,
  ) {
    await this.ledger.lockAccount(tx, order.userId);
    const lot = await this.purchaseLot(tx, order.id);
    if (!lot) throw new Error('Purchase reward lot not found.');
    if (lot.activatedAt) return this.complete(tx, job, now);
    if (lot.expiresAt <= now) return this.skip(tx, job, 'CREDIT_EXPIRED', now);
    if (!isRewardablePurchase(order)) {
      await this.walletCheckout.adjustPurchaseReward(
        tx,
        order,
        `purchase-reward:ineligible:${order.id}`,
        true,
      );
      return this.skip(tx, job, 'ORDER_INELIGIBLE', now);
    }
    const { activationDelayDays: delay } = job.calculation as unknown as RecordedPurchaseReward;
    const nextCheck = this.activationCheck(order, now, delay);
    if (nextCheck > now) {
      await tx.purchaseRewardJob.update({
        where: { orderId: order.id },
        data: {
          status: 'WAITING',
          nextAttemptAt: nextCheck,
          attempts: 0,
          resultCode: null,
          ...leaseCleared,
        },
      });
      return 'waiting' as const;
    }

    // Returns and cash refunds can reduce the pending lot after calculation.
    await this.walletCheckout.adjustPurchaseReward(
      tx,
      order,
      `purchase-reward:activation-adjust:${order.id}`,
      false,
    );
    const current = await this.purchaseLot(tx, order.id);
    if (!current?.pendingToman) return this.skip(tx, job, 'NO_PENDING_CREDIT', now);
    await this.ledger.activate(
      {
        userId: order.userId,
        lotId: lot.id,
        idempotencyKey: `purchase-reward:activate:${order.id}`,
      },
      tx,
    );
    return this.complete(tx, job, now);
  }

  private activationCheck(order: PurchaseRewardOrder, now: Date, delayDays: number) {
    if (order.status !== 'DELIVERED' || !order.deliveredAt || order.returns.length) {
      return new Date(+now + deliveryPoll);
    }
    return new Date(+order.deliveredAt + delayDays * day);
  }

  private purchaseLot(tx: Prisma.TransactionClient, orderId: string) {
    return tx.walletLot.findFirst({
      where: { orderId, source: 'PURCHASE' },
      select: { id: true, expiresAt: true, activatedAt: true, pendingToman: true },
    });
  }

  private async complete(tx: Prisma.TransactionClient, job: PurchaseRewardJob, now: Date) {
    await tx.purchaseRewardJob.update({
      where: { orderId: job.orderId },
      data: {
        status: 'COMPLETED',
        resultCode: 'ACTIVATED',
        finishedAt: now,
        ...leaseCleared,
      },
    });
    return 'completed' as const;
  }

  private async skip(
    tx: Prisma.TransactionClient,
    job: PurchaseRewardJob,
    reason: string,
    now: Date,
    extra?: { policyVersion: number; calculation: RecordedPurchaseReward },
  ) {
    await tx.purchaseRewardJob.update({
      where: { orderId: job.orderId },
      data: {
        ...extra,
        status: 'SKIPPED',
        resultCode: reason,
        finishedAt: now,
        ...leaseCleared,
      },
    });
    return 'skipped' as const;
  }

  private async recordFailure(claim: Claim, now: Date) {
    const exhausted = claim.attempts >= maxAttempts;
    const nextAttempt = new Date(+now + Math.min(2 ** (claim.attempts - 1), 60) * minute);
    const result = await this.db.purchaseRewardJob.updateMany({
      where: { orderId: claim.orderId, status: 'PROCESSING', leaseToken: claim.leaseToken },
      data: {
        status: exhausted ? 'DEAD_LETTER' : claim.calculated ? 'WAITING' : 'PENDING',
        resultCode: 'PROCESSING_FAILED',
        nextAttemptAt: nextAttempt,
        finishedAt: exhausted ? now : null,
        ...leaseCleared,
      },
    });
    if (!result.count) return 'lost' as const;
    return exhausted ? ('deadLetter' as const) : ('retry' as const);
  }
}
