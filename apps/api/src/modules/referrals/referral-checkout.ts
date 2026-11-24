import { ConflictException } from '@nestjs/common';
import { MIN_WALLET_CASH_PAYMENT_TOMAN } from '../../common/toman';
import type { Prisma } from '../../generated/prisma/client';
import type { PromotionLine } from '../promotions/promotion-engine';
import { allocateCheckoutToman } from '../wallet/wallet-checkout';
import { openWalletAttemptStatuses } from '../wallet/wallet-checkout.service';
import type { ReferralRewardDefinitionDto } from './dto/referral-reward-policy.dto';
import { lockReferralBudget, referralBudgetUsage } from './referral-budget';
import { findQualifyingReferralPurchase, lockReferralBuyer } from './referral-eligibility';
import { evaluateReferralRewards } from './referral-reward-engine';

const day = 86_400_000;

async function availableClaim(tx: Prisma.TransactionClient, userId: string, now: Date) {
  const claim = await tx.referralAttribution.findFirst({
    where: {
      referredUserId: userId,
      firstOrderId: null,
      expiresAt: { gt: now },
      checkoutOrders: {
        none: {
          referralCheckoutReleasedAt: null,
          OR: [{ paidAt: { not: null } }, { status: { notIn: ['CANCELLED', 'EXPIRED'] } }],
        },
      },
    },
    select: {
      id: true,
      referrerUserId: true,
      claimedAt: true,
      expiresAt: true,
      rewardPolicy: { select: { version: true, definition: true } },
    },
  });
  if (!claim?.rewardPolicy) return null;
  const definition = claim.rewardPolicy.definition as unknown as ReferralRewardDefinitionDto;
  if (!definition.enabled || !Array.isArray(definition.rules)) return null;
  const rules = definition.rules.filter(
    (rule) =>
      rule.enabled &&
      rule.recipient === 'REFERRED' &&
      +claim.claimedAt + rule.expiryDays * day > +now,
  );
  if (
    !rules.length ||
    !(await findQualifyingReferralPurchase(tx, claim.referrerUserId, claim.claimedAt))
  ) {
    return null;
  }
  return { ...claim, version: claim.rewardPolicy.version, definition: { ...definition, rules } };
}

export async function referralCheckoutAvailable(db: Prisma.TransactionClient, userId: string) {
  return Boolean(await availableClaim(db, userId, new Date()));
}

export async function quoteReferralCheckout(
  tx: Prisma.TransactionClient,
  input: {
    userId: string;
    lines: readonly PromotionLine[];
    discounts: readonly number[];
    payableToman: number;
    couponApplied: boolean;
    campaignId: string | null;
    reserve: boolean;
  },
) {
  const remainingIncentiveToman = input.payableToman - MIN_WALLET_CASH_PAYMENT_TOMAN;
  if (remainingIncentiveToman <= 0) return null;
  const [{ now, budgetAt }] = await tx.$queryRaw<{ now: Date; budgetAt: Date }[]>`
    SELECT clock_timestamp()::timestamptz(3) AS now, CURRENT_TIMESTAMP AS "budgetAt"
  `;
  const claim = await availableClaim(tx, input.userId, now);
  if (!claim) return null;
  if (input.reserve) await lockReferralBudget(tx, claim.version, budgetAt);
  const rows = await referralBudgetUsage(tx, input.userId, claim.version, budgetAt);
  const lines = input.lines.map((line, index) => ({
    categoryIds: [...line.categoryIds],
    eligibleToman: line.unitSalePriceToman * line.quantity - input.discounts[index],
  }));
  const result = evaluateReferralRewards(claim.definition, {
    lines,
    remainingIncentiveToman,
    campaignId: input.campaignId,
    couponApplied: input.couponApplied,
    confirmed: true,
    purchaseRank: 1,
    purchaseRewardApplied: false,
    occurredAt: now.toISOString(),
    usage: rows
      .filter(({ ruleCode }) => claim.definition.rules.some(({ code }) => code === ruleCode))
      .map(({ ruleCode, committed, uses }) => ({
        ruleCode,
        recipientUses: Number(uses),
        committedToman: Number(committed),
      })),
    programCommittedToman: rows.reduce((sum, { committed }) => sum + Number(committed), 0),
  }).recipients.find(({ recipient }) => recipient === 'REFERRED');
  if (!result?.amountToman) return null;
  const rule = claim.definition.rules.find(({ code }) => code === result.ruleCode);
  if (!rule) return null;
  const categoryScope = new Set(rule.allowedCategoryIds.map((id) => id.toLowerCase()));
  const amountToman = Math.min(result.amountToman, result.eligibleToman);
  const lineAmounts = allocateCheckoutToman(
    amountToman,
    lines.map((line) =>
      !categoryScope.size || line.categoryIds.some((id) => categoryScope.has(id.toLowerCase()))
        ? line.eligibleToman
        : 0,
    ),
  );
  return {
    attributionId: claim.id,
    policyVersion: claim.version,
    ruleCode: rule.code,
    lineAmounts,
    amountToman,
    allowPurchaseReward: rule.allowPurchaseReward,
    expiresAt: new Date(
      Math.min(
        +claim.expiresAt,
        +claim.claimedAt + rule.expiryDays * day,
        rule.endsAt ? Date.parse(rule.endsAt) : Infinity,
      ),
    ).toISOString(),
  };
}

export async function assertReferralPayment(
  tx: Prisma.TransactionClient,
  order: { id: string; userId: string; referralCheckoutAttributionId?: string | null },
) {
  if (!order.referralCheckoutAttributionId) return;
  await lockReferralBuyer(tx, order.userId);
  const claim = await tx.referralAttribution.findFirst({
    where: { id: order.referralCheckoutAttributionId, referredUserId: order.userId },
    select: { firstOrderId: true },
  });
  if (!claim || (claim.firstOrderId && claim.firstOrderId !== order.id)) {
    throw new ConflictException('اعتبار معرفی فقط برای اولین خرید معتبر است.');
  }
}

export async function releaseReferralCheckoutAfterFailure(
  tx: Prisma.TransactionClient,
  order: { id: string; referralCheckoutAttributionId?: string | null },
) {
  if (!order.referralCheckoutAttributionId) return;
  await tx.order.updateMany({
    where: {
      id: order.id,
      status: 'PENDING_PAYMENT',
      paidAt: null,
      referralCheckoutReleasedAt: null,
      payment: { is: { attempts: { none: { status: { in: [...openWalletAttemptStatuses] } } } } },
    },
    data: { referralCheckoutReleasedAt: new Date() },
  });
}

export async function reacquireReferralCheckout(
  tx: Prisma.TransactionClient,
  order: { id: string; userId: string; referralCheckoutAttributionId?: string | null },
) {
  if (!order.referralCheckoutAttributionId) return;
  const snapshot = await tx.order.findUniqueOrThrow({
    where: { id: order.id },
    select: {
      createdAt: true,
      referralCheckoutReleasedAt: true,
      referralCheckoutRuleCode: true,
      referralDiscountToman: true,
    },
  });
  if (!snapshot.referralCheckoutReleasedAt) return;
  const unavailable = () => new ConflictException('اعتبار معرفی برای این سفارش قابل رزرو نیست.');
  const claim = await availableClaim(tx, order.userId, new Date());
  const rule = claim?.definition.rules.find(
    ({ code }) => code === snapshot.referralCheckoutRuleCode,
  );
  if (!claim || !rule) throw unavailable();
  await lockReferralBudget(tx, claim.version, snapshot.createdAt);
  const rows = await referralBudgetUsage(tx, order.userId, claim.version, snapshot.createdAt);
  const usage = rows.find(({ ruleCode }) => ruleCode === rule.code);
  const amount = BigInt(snapshot.referralDiscountToman);
  if (
    (usage?.uses ?? 0n) >= BigInt(rule.maxUsesPerRecipient) ||
    (usage?.committed ?? 0n) + amount > BigInt(rule.periodBudgetToman) ||
    rows.reduce((sum, { committed }) => sum + committed, amount) >
      BigInt(claim.definition.periodBudgetToman)
  ) {
    throw unavailable();
  }
  await tx.order.update({ where: { id: order.id }, data: { referralCheckoutReleasedAt: null } });
}
