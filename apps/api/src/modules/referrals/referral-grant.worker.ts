import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TOMAN_INT_MAX } from '../../common/toman';
import type { Prisma, ReferralGrantJob, WalletLot } from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import {
  committedCampaignIncentives,
  discountBudget,
  promotionUsage,
} from '../promotions/promotion-budget';
import { RewardPoliciesService } from '../reward-policies/reward-policies.service';
import {
  isRewardablePurchase,
  purchaseRewardOrderSelect,
  resolvePurchaseRewardBasis,
  rewardLinesForOrder,
  type PurchaseRewardOrder,
} from '../wallet/purchase-reward-basis';
import { purchaseRewardBudget } from '../wallet/purchase-reward-calculation';
import { exactWalletToman, WalletLedgerService } from '../wallet/wallet-ledger.service';
import type {
  ReferralRewardDefinitionDto,
  ReferralRewardRuleDto,
  ReferralRewardSampleDto,
} from './dto/referral-reward-policy.dto';
import { lockReferralBudget, referralBudgetUsage } from './referral-budget';
import { findQualifyingReferralPurchase } from './referral-eligibility';
import { evaluateReferralRewards } from './referral-reward-engine';

const minute = 60_000;
const day = 24 * 60 * minute;
const firstOrderSelect = {
  ...purchaseRewardOrderSelect,
  createdAt: true,
  referralCheckoutAttributionId: true,
  priceQuote: {
    select: {
      ...purchaseRewardOrderSelect.priceQuote.select,
      campaignId: true,
    },
  },
  walletRewardLots: {
    where: { source: 'PURCHASE' },
    take: 1,
    select: { grantedToman: true },
  },
} satisfies Prisma.OrderSelect;
type Order = Prisma.OrderGetPayload<{ select: typeof firstOrderSelect }>;
type Candidate = Pick<ReferralGrantJob, 'attributionId' | 'attempts'> & {
  batchAt: Date;
  nextAttemptAt: Date;
  orderId: string;
};
type GrantCalculation = {
  rule: ReferralRewardRuleDto;
  sample: ReferralRewardSampleDto;
  walletPolicyVersion: number;
  referrerPurchaseOrderId: string;
  approvalRevision: number;
};

function rewardLines(order: PurchaseRewardOrder) {
  return rewardLinesForOrder(order, resolvePurchaseRewardBasis(order)).map(
    ({
      categoryIds,
      merchandiseToman,
      directDiscountToman,
      settledCreditToman,
      refundedCashToman,
    }) => ({
      categoryIds,
      eligibleToman:
        merchandiseToman - directDiscountToman - settledCreditToman - refundedCashToman,
    }),
  );
}

@Injectable()
export class ReferralGrantWorker {
  private readonly logger = new Logger(ReferralGrantWorker.name);

  constructor(
    private readonly db: PrismaService,
    private readonly ledger: WalletLedgerService,
    private readonly walletPolicies: RewardPoliciesService,
    private readonly config: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE, { name: 'referral-grant-jobs', waitForCompletion: true })
  async tick() {
    if (!this.config.get<boolean>('REFERRAL_GRANT_WORKER_ENABLED', false)) return;
    try {
      await this.run();
    } catch {
      this.logger.warn('Referral grant batch could not run.');
    }
  }

  async run(at?: Date) {
    const candidates = await this.db.$queryRaw<Candidate[]>`
      WITH batch_clock AS (
        SELECT COALESCE(${at ?? null}::timestamptz, statement_timestamp()::timestamptz(3)) AS now
      )
      SELECT j."attributionId", j.attempts, j."nextAttemptAt", a."firstOrderId" AS "orderId",
        batch_clock.now AS "batchAt"
      FROM "referral_grant_jobs" j JOIN "referral_attributions" a ON a.id = j."attributionId"
      CROSS JOIN batch_clock
      WHERE j."nextAttemptAt" <= batch_clock.now
      ORDER BY j."nextAttemptAt", j."attributionId" LIMIT 20
    `;
    for (const candidate of candidates) {
      const now = candidate.batchAt;
      try {
        await this.db.$transaction((tx) => this.process(tx, candidate, now), { timeout: 15_000 });
      } catch (error) {
        this.logger.warn(
          `Referral grant ${candidate.attributionId} will retry (${error instanceof Error ? error.name : 'UnknownError'}).`,
        );
        await this.db.referralGrantJob.updateMany({
          where: { attributionId: candidate.attributionId, nextAttemptAt: candidate.nextAttemptAt },
          data: {
            attempts: { increment: 1 },
            resultCode: 'PROCESSING_ERROR',
            nextAttemptAt: new Date(
              +now + Math.min(60, 2 ** Math.min(candidate.attempts, 6)) * minute,
            ),
          },
        });
      }
    }
  }

  private async process(tx: Prisma.TransactionClient, candidate: Candidate, now: Date) {
    // Return and refund writers also lock the order before updating financial state.
    const [orderLock] = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM "orders" WHERE id = ${candidate.orderId}::uuid FOR UPDATE SKIP LOCKED
    `;
    if (!orderLock) return;
    const [risk] = await tx.$queryRaw<
      { action: 'ALLOW' | 'REVIEW' | 'HOLD' | 'REJECT'; revision: number }[]
    >`
      SELECT action, revision FROM "referral_risk_assessments"
      WHERE "attributionId" = ${candidate.attributionId}::uuid AND "orderId" = ${candidate.orderId}::uuid
      FOR UPDATE
    `;
    await tx.$queryRaw`SELECT 1 FROM "referral_grant_jobs"
      WHERE "attributionId" = ${candidate.attributionId}::uuid FOR UPDATE`;
    const job = await tx.referralGrantJob.findUniqueOrThrow({
      where: { attributionId: candidate.attributionId },
      include: { attribution: { include: { rewardPolicy: true } }, lot: true },
    });
    if (!job.nextAttemptAt || job.nextAttemptAt > now) return;
    const order = await tx.order.findUniqueOrThrow({
      where: { id: candidate.orderId },
      select: firstOrderSelect,
    });
    const { attribution } = job;
    const paidAt = attribution.firstPaidAt;
    const finish = (
      status: ReferralGrantJob['status'],
      resultCode: string,
      nextAttemptAt: Date | null = null,
    ) =>
      tx.referralGrantJob.update({
        where: { attributionId: job.attributionId },
        data: {
          status,
          resultCode,
          nextAttemptAt,
          attempts: 0,
          processedAt: now,
          riskRevision: risk?.revision,
        },
      });

    if (job.lot) {
      await this.correct(tx, job, job.lot, order, now, risk?.action === 'REJECT', risk?.revision);
      return;
    }
    if (
      !paidAt ||
      paidAt < attribution.claimedAt ||
      (paidAt >= attribution.expiresAt && order.referralCheckoutAttributionId !== attribution.id)
    ) {
      return finish('EXPIRED', 'ATTRIBUTION_EXPIRED');
    }
    if (!isRewardablePurchase(order) || order.userId !== attribution.referredUserId) {
      return finish('REJECTED', 'ORDER_INELIGIBLE');
    }
    const definition = attribution.rewardPolicy?.definition as unknown as
      ReferralRewardDefinitionDto | undefined;
    const rules = definition?.rules?.filter((rule) => rule.recipient === 'REFERRER') ?? [];
    if (
      !attribution.rewardPolicy ||
      !definition?.enabled ||
      !rules.some(({ enabled }) => enabled)
    ) {
      return finish('REJECTED', 'POLICY_INELIGIBLE');
    }
    if (!risk) {
      // An assessment can commit after the lock query first sees no row.
      const appeared = await tx.referralRiskAssessment.findFirst({
        where: { attributionId: attribution.id, orderId: order.id },
        select: { attributionId: true },
      });
      return finish('PENDING', 'RISK_PENDING', appeared ? new Date(+now + minute) : null);
    }
    if (risk.action === 'REJECT') return finish('REJECTED', 'RISK_REJECTED');
    if (risk.action !== 'ALLOW') return finish('PENDING', 'RISK_PENDING');
    if (order.status !== 'DELIVERED' || !order.deliveredAt)
      return finish('PENDING', 'DELIVERY_PENDING');
    if (order.returns.length) return finish('PENDING', 'RETURN_PENDING');
    const referrerPurchase = await findQualifyingReferralPurchase(
      tx,
      attribution.referrerUserId,
      attribution.claimedAt,
    );
    if (!referrerPurchase) {
      return finish('REJECTED', 'REFERRER_INELIGIBLE');
    }
    const { policy: walletPolicy } = await this.walletPolicies.active(paidAt, tx);
    if (!walletPolicy?.enabled) return finish('REJECTED', 'WALLET_POLICY_INELIGIBLE');

    const version = attribution.rewardPolicy.version;
    const campaignId = order.priceQuote?.campaignId ?? null;
    const budgetAt =
      order.referralCheckoutAttributionId === attribution.id ? order.createdAt : paidAt;
    const campaignRemaining = await this.campaignRemaining(tx, campaignId);
    const buyerDiscount = order.discountTotalToman + (order.priceQuote?.shippingDiscountToman ?? 0);
    const purchaseReward = order.walletRewardLots[0]?.grantedToman ?? 0;
    const { usage: walletUsage } = await purchaseRewardBudget(
      tx,
      attribution.referrerUserId,
      order.id,
      paidAt,
    );
    const budget = walletPolicy.definition.budget;
    const remainingIncentiveToman = Math.max(
      0,
      Math.min(
        campaignRemaining,
        budget.incentivesPerOrderToman - buyerDiscount - purchaseReward,
        budget.incentivesPerPeriodToman -
          walletUsage.periodIncentivesToman -
          buyerDiscount -
          purchaseReward,
        budget.incentivesPerCustomerPeriodToman - walletUsage.customerIncentivesToman,
      ),
    );
    await lockReferralBudget(tx, version, budgetAt);
    const usage = await referralBudgetUsage(tx, attribution.referrerUserId, version, budgetAt);
    const sample: ReferralRewardSampleDto = {
      lines: rewardLines(order),
      confirmed: true,
      occurredAt: paidAt.toISOString(),
      purchaseRank: 1,
      purchaseRewardApplied: purchaseReward > 0,
      campaignId,
      couponApplied: resolvePurchaseRewardBasis(order).couponApplied,
      remainingIncentiveToman,
      programCommittedToman: exactWalletToman(usage.reduce((sum, row) => sum + row.committed, 0n)),
      usage: usage
        .filter(({ ruleCode }) => rules.some(({ code }) => code === ruleCode))
        .map((row) => ({
          ruleCode: row.ruleCode,
          recipientUses: Number(row.uses),
          committedToman: exactWalletToman(row.committed),
        })),
    };
    const result = evaluateReferralRewards({ ...definition, rules }, sample).recipients.find(
      ({ recipient }) => recipient === 'REFERRER',
    );
    const rule = rules.find(({ code }) => code === result?.ruleCode);
    if (!rule || !result?.amountToman) return finish('REJECTED', result?.reason ?? 'NO_MATCH');
    const grant = await this.ledger.grant(
      {
        userId: attribution.referrerUserId,
        orderId: order.id,
        source: 'REFERRAL',
        sourceKey: attribution.id,
        referralPolicyVersion: version,
        amountToman: result.amountToman,
        expiresAt: new Date(Date.now() + rule.expiryDays * day),
        idempotencyKey: `referral:grant:${attribution.id}`,
      },
      tx,
    );
    const lotId = grant.movements[0].lotId;
    await this.ledger.activate(
      {
        userId: attribution.referrerUserId,
        lotId,
        idempotencyKey: `referral:activate:${attribution.id}`,
      },
      tx,
    );
    if (campaignId) {
      await tx.orderPriceQuote.update({
        where: { orderId: order.id },
        data: { referralRewardToman: result.amountToman },
      });
    }
    await tx.referralGrantJob.update({
      where: { attributionId: job.attributionId },
      data: {
        lotId,
        status: 'APPROVED',
        ruleCode: rule.code,
        budgetAt,
        resultCode: 'ISSUED',
        riskRevision: risk.revision,
        attempts: 0,
        processedAt: now,
        nextAttemptAt: null,
        calculation: JSON.parse(
          JSON.stringify({
            rule,
            sample,
            walletPolicyVersion: walletPolicy.version,
            referrerPurchaseOrderId: referrerPurchase.id,
            approvalRevision: risk.revision,
          } satisfies GrantCalculation),
        ) as Prisma.InputJsonObject,
      },
    });
  }

  private async campaignRemaining(tx: Prisma.TransactionClient, campaignId: string | null) {
    if (!campaignId) return TOMAN_INT_MAX;
    await tx.$queryRaw`SELECT 1 FROM "campaigns" WHERE id = ${campaignId}::uuid FOR UPDATE`;
    const campaign = await tx.campaign.findUniqueOrThrow({
      where: { id: campaignId },
      select: { budgetToman: true, plannedChannelCostToman: true },
    });
    return (
      discountBudget(campaign) - committedCampaignIncentives(await promotionUsage(tx, campaignId))
    );
  }

  private async correct(
    tx: Prisma.TransactionClient,
    job: ReferralGrantJob,
    previousLot: WalletLot,
    order: Order,
    now: Date,
    riskRejected: boolean,
    riskRevision: number | undefined,
  ) {
    const { rule, sample } = job.calculation as unknown as GrantCalculation;
    const eligible = !riskRejected && isRewardablePurchase(order);
    const remaining = eligible
      ? evaluateReferralRewards(
          {
            enabled: true,
            rules: [rule],
            periodBudgetToman: previousLot.grantedToman,
          },
          {
            ...sample,
            lines: rewardLines(order),
            usage: [],
            programCommittedToman: 0,
            remainingIncentiveToman: previousLot.grantedToman,
          },
        ).totalToman
      : 0;
    const revocationToman = Math.max(job.revocationToman, previousLot.grantedToman - remaining);
    await this.ledger.lockAccount(tx, previousLot.userId);
    const lot = await tx.walletLot.findUniqueOrThrow({ where: { id: previousLot.id } });
    const revoke =
      lot.expiresAt > new Date()
        ? Math.max(
            0,
            Math.min(revocationToman - lot.revokedToman, lot.availableToman + lot.pendingToman),
          )
        : 0;
    if (revoke > 0) {
      await this.ledger.revokeGrant(
        {
          userId: lot.userId,
          lotId: lot.id,
          amountToman: revoke,
          idempotencyKey: `referral:revoke:${job.attributionId}:${lot.revokedToman + revoke}`,
        },
        tx,
      );
    }
    const recoveryDueToman = Math.max(
      0,
      Math.min(revocationToman - lot.revokedToman - revoke, lot.reservedToman + lot.capturedToman),
    );
    await tx.referralGrantJob.update({
      where: { attributionId: job.attributionId },
      data: {
        status:
          revocationToman >= lot.grantedToman
            ? 'REJECTED'
            : lot.expiresAt <= now
              ? 'EXPIRED'
              : 'APPROVED',
        resultCode: recoveryDueToman ? 'RECOVERY_DUE' : revocationToman ? 'CORRECTED' : 'ISSUED',
        revocationToman,
        recoveryDueToman,
        riskRevision,
        attempts: 0,
        processedAt: now,
        nextAttemptAt: recoveryDueToman ? new Date(+now + 10 * minute) : null,
      },
    });
  }
}
