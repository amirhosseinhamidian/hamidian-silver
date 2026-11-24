import type { Prisma } from '../../generated/prisma/client';
import type {
  RewardPeriodUsageDto,
  RewardPolicyDefinitionDto,
} from '../reward-policies/dto/reward-policy.dto';
import { calculateRewardPolicy } from '../reward-policies/reward-policy-engine';
import {
  isRewardablePurchase,
  rewardLinesForOrder,
  type PurchaseRewardBasis,
  type PurchaseRewardOrder,
} from './purchase-reward-basis';

export type RecordedPurchaseReward = {
  basis: PurchaseRewardBasis;
  previousCompletedPurchases: number;
  usage: Record<keyof RewardPeriodUsageDto, number>;
  otherOrderIncentivesToman: number;
  otherCustomerOrderIncentivesToman?: number;
  ruleCode: string | null;
  baseToman: number;
  grantedToman: number;
  activationDelayDays: number;
};

export function evaluatePurchaseReward(
  version: number,
  definition: RewardPolicyDefinitionDto,
  order: PurchaseRewardOrder,
  context: Pick<
    RecordedPurchaseReward,
    | 'basis'
    | 'previousCompletedPurchases'
    | 'usage'
    | 'otherOrderIncentivesToman'
    | 'otherCustomerOrderIncentivesToman'
  >,
) {
  return calculateRewardPolicy(version, definition, {
    lines: rewardLinesForOrder(order, context.basis),
    outcome: isRewardablePurchase(order) ? 'PAID' : 'FULLY_RETURNED',
    previousCompletedPurchases: context.previousCompletedPurchases,
    couponApplied: context.basis.couponApplied,
    shippingDiscountToman: context.basis.shippingDiscountToman,
    otherOrderIncentivesToman: context.otherOrderIncentivesToman,
    otherCustomerOrderIncentivesToman: context.otherCustomerOrderIncentivesToman,
    availableCreditToman: 0,
    usage: context.usage,
  });
}

export async function previousPurchases(
  db: Prisma.TransactionClient,
  userId: string,
  orderId: string,
  sequence: bigint,
  paidAt: Date,
) {
  const [{ count }] = await db.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) AS count
    FROM "orders" o JOIN "payments" p ON p."orderId" = o.id
    LEFT JOIN "purchase_reward_jobs" j ON j."orderId" = o.id
    WHERE o."userId" = ${userId}::uuid AND o.id <> ${orderId}::uuid AND o."paidAt" IS NOT NULL
      AND o.status IN ('PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED')
      AND p.status IN ('PAID', 'PARTIALLY_REFUNDED')
      AND (j.sequence < ${sequence} OR (j.sequence IS NULL AND (o."paidAt", o.id) < (${paidAt}::timestamptz, ${orderId}::uuid)))
      AND EXISTS (SELECT 1 FROM "order_items" item
        WHERE item."orderId" = o.id AND item."returnedQuantity" < item.quantity)
  `;
  return Number(count);
}

export async function purchaseRewardBudget(
  db: Prisma.TransactionClient,
  userId: string,
  orderId: string,
  paidAt: Date,
) {
  // One grant transaction at a time can commit spend against this shared period.
  await db.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(
    'purchase-reward-budget:' || to_char(${paidAt}::timestamptz AT TIME ZONE 'Asia/Tehran', 'YYYY-MM'), 0))`;
  type Totals = {
    customerRewards: bigint;
    periodRewards: bigint;
    customerIncentives: bigint;
    periodIncentives: bigint;
    otherOrderIncentives: bigint;
    otherCustomerOrderIncentives: bigint;
  };
  const [row] = await db.$queryRaw<Totals[]>`
    WITH month AS (
      SELECT date_trunc('month', ${paidAt}::timestamptz AT TIME ZONE 'Asia/Tehran') AS start
    ), paid_orders AS MATERIALIZED (
      SELECT o.id, o."userId", o."discountTotalToman"::bigint + COALESCE(q."shippingDiscountToman", 0) AS discount
      FROM "orders" o JOIN "payments" p ON p."orderId" = o.id
      LEFT JOIN "order_price_quotes" q ON q."orderId" = o.id
      CROSS JOIN month
      WHERE o."paidAt" >= (month.start AT TIME ZONE 'Asia/Tehran')
        AND o."paidAt" < ((month.start + interval '1 month') AT TIME ZONE 'Asia/Tehran')
        AND p.status IN ('PAID', 'PARTIALLY_REFUNDED', 'REFUNDED')
    ), discounts AS (
      SELECT COALESCE(SUM(discount), 0) AS period,
        COALESCE(SUM(discount) FILTER (WHERE "userId" = ${userId}::uuid), 0) AS customer
      FROM paid_orders WHERE id <> ${orderId}::uuid
    ), credits AS (
      SELECT
        COALESCE(SUM(l."grantedToman") FILTER (WHERE o.id <> ${orderId}::uuid AND l.source = 'PURCHASE'), 0) AS reward_period,
        COALESCE(SUM(l."grantedToman") FILTER (WHERE o.id <> ${orderId}::uuid AND l.source = 'PURCHASE' AND l."userId" = ${userId}::uuid), 0) AS reward_customer,
        COALESCE(SUM(l."grantedToman") FILTER (WHERE o.id <> ${orderId}::uuid), 0) AS incentive_period,
        COALESCE(SUM(l."grantedToman") FILTER (WHERE o.id <> ${orderId}::uuid AND l."userId" = ${userId}::uuid), 0) AS incentive_customer,
        COALESCE(SUM(l."grantedToman") FILTER (WHERE o.id = ${orderId}::uuid AND l.source = 'REFERRAL'), 0) AS current_incentive,
        COALESCE(SUM(l."grantedToman") FILTER (WHERE o.id = ${orderId}::uuid AND l.source = 'REFERRAL' AND l."userId" = ${userId}::uuid), 0) AS current_customer_incentive
      FROM paid_orders o JOIN "wallet_lots" l ON l."orderId" = o.id
    )
    SELECT reward_period::bigint AS "periodRewards", reward_customer::bigint AS "customerRewards",
      (incentive_period + discounts.period)::bigint AS "periodIncentives",
      (incentive_customer + discounts.customer)::bigint AS "customerIncentives",
      current_incentive::bigint AS "otherOrderIncentives",
      current_customer_incentive::bigint AS "otherCustomerOrderIncentives"
    FROM credits CROSS JOIN discounts
  `;
  return {
    usage: {
      customerRewardsToman: Number(row.customerRewards),
      periodRewardsToman: Number(row.periodRewards),
      customerIncentivesToman: Number(row.customerIncentives),
      periodIncentivesToman: Number(row.periodIncentives),
    },
    otherOrderIncentivesToman: Number(row.otherOrderIncentives),
    otherCustomerOrderIncentivesToman: Number(row.otherCustomerOrderIncentives),
  };
}
