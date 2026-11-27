import { createHash } from 'node:crypto';
import { Prisma } from '../../generated/prisma/client';
import { growthReportPeriodSql } from '../growth-attribution/growth-revenue-events';
import { growthRevenuePeriod } from '../growth-attribution/growth-revenue.service';
import {
  evaluatePurchaseReward,
  previousPurchases,
  readPurchaseRewardBudget,
  type RecordedPurchaseReward,
} from '../wallet/purchase-reward-calculation';
import {
  isRewardablePurchase,
  purchaseRewardOrderSelect,
  resolvePurchaseRewardBasis,
  rewardLinesForOrder,
} from '../wallet/purchase-reward-basis';
import type { PolicyHistoryResultDto, PolicyHistoryScenarioDto } from './dto/policy-simulation.dto';
import type { RewardPolicyDetailDto } from './dto/reward-policy.dto';

const historicalOrderLimit = 100;
const queuedOrderLimit = 12;

export async function replayPurchaseRewards(
  tx: Prisma.TransactionClient,
  policy: RewardPolicyDetailDto,
  input: PolicyHistoryScenarioDto,
): Promise<PolicyHistoryResultDto> {
  const period = growthRevenuePeriod(input);
  const pendingOnly = input.pendingOnly === true;
  const orderLimit = pendingOnly ? queuedOrderLimit : historicalOrderLimit;
  const [{ starts_at: start, ends_before: end }] = await tx.$queryRaw<
    { starts_at: Date; ends_before: Date }[]
  >(growthReportPeriodSql(period));
  const orders = await tx.order.findMany({
    where: {
      paidAt: { gte: start, lt: end },
      ...(pendingOnly
        ? {
            purchaseRewardJob: {
              is: {
                status: { in: ['PENDING', 'PROCESSING'] },
                calculation: { equals: Prisma.DbNull },
              },
            },
          }
        : {}),
    },
    orderBy: [{ paidAt: 'asc' }, { id: 'asc' }],
    take: orderLimit + 1,
    select: {
      ...purchaseRewardOrderSelect,
      purchaseRewardJob: { select: { calculation: true, paidAt: true, sequence: true } },
      firstReferralPurchase: {
        select: { grantJob: { select: { calculation: true, lotId: true } } },
      },
    },
  });

  let evaluatedOrders = 0;
  let recordedRewardToman = 0;
  let estimatedRewardToman = 0;
  let limitedOrders = 0;
  const fingerprint = createHash('sha256');
  const sample = orders.slice(0, orderLimit);

  for (const order of sample) {
    const job = order.purchaseRewardJob;
    const recorded = job?.calculation as unknown as RecordedPurchaseReward | null;
    const referral = order.firstReferralPurchase?.grantJob;
    const referralCalculation = referral?.calculation as
      { rule?: { allowPurchaseReward?: boolean } } | undefined;
    let context: Parameters<typeof evaluatePurchaseReward>[3];
    if (pendingOnly) {
      if (!job || !order.purchaseRewardBasis || !isRewardablePurchase(order)) continue;
      const basis = resolvePurchaseRewardBasis(order);
      if (
        basis.referralAllowsPurchaseReward === false ||
        (referral?.lotId && referralCalculation?.rule?.allowPurchaseReward === false)
      )
        continue;
      const rank = await previousPurchases(tx, order.userId, order.id, job.sequence, job.paidAt);
      const budget = await readPurchaseRewardBudget(tx, order.userId, order.id, job.paidAt);
      context = { ...budget, basis, previousCompletedPurchases: rank };
    } else {
      if (!recorded?.basis || !recorded.usage) continue;
      context = recorded;
    }

    const result = evaluatePurchaseReward(policy.version, policy.definition, order, context);
    fingerprint.update(
      JSON.stringify({
        lines: rewardLinesForOrder(order, context.basis),
        rank: context.previousCompletedPurchases,
        usage: context.usage,
        coupon: context.basis.couponApplied,
        shippingDiscount: context.basis.shippingDiscountToman,
        otherIncentives: context.otherOrderIncentivesToman,
        otherCustomerIncentives: context.otherCustomerOrderIncentivesToman,
        recordedReward: recorded?.grantedToman ?? null,
        result,
      }) + '\n',
    );
    recordedRewardToman += recorded?.grantedToman ?? 0;
    estimatedRewardToman += result.estimatedRewardToman;
    if (
      result.existingIncentivesExceedLimit ||
      result.estimatedRewardToman < result.calculatedRewardToman
    )
      limitedOrders++;
    evaluatedOrders++;
  }
  return {
    version: policy.version,
    pendingOnly,
    scannedOrders: sample.length,
    evaluatedOrders,
    withoutEvidence: sample.length - evaluatedOrders,
    truncated: orders.length > orderLimit,
    recordedRewardToman,
    estimatedRewardToman,
    limitedOrders,
    fingerprint: fingerprint.digest('hex'),
    reviewId: null,
  };
}
