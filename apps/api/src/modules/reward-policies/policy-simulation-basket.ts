import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MIN_WALLET_CASH_PAYMENT_TOMAN, TOMAN_INT_MAX } from '../../common/toman';
import type { Prisma } from '../../generated/prisma/client';
import { campaignBudget } from '../campaigns/campaign-operations';
import { planQuotaAllocations } from '../campaigns/campaign-quota';
import {
  calculatePromotion,
  isPromotionTarget,
  matchesPromotionAudience,
  percentageDiscountWeights,
  readPercentageOverrides,
  type PromotionLine,
} from '../promotions/promotion-engine';
import type {
  ReferralRewardDefinitionDto,
  ReferralRewardSampleDto,
} from '../referrals/dto/referral-reward-policy.dto';
import type { ReferralRiskPolicyDto } from '../referrals/dto/referral-risk.dto';
import { evaluateReferralRewards } from '../referrals/referral-reward-engine';
import { assessReferralRisk, defaultReferralRiskPolicy } from '../referrals/referral-risk-engine';
import { allocateCheckoutDiscount, allocateCheckoutToman } from '../wallet/wallet-checkout';
import type { PolicyBasketResultDto, PolicyBasketScenarioDto } from './dto/policy-simulation.dto';
import {
  DEFAULT_REWARD_ACTIVATION_DELAY_DAYS,
  type RewardPolicyDetailDto,
} from './dto/reward-policy.dto';
import { calculateRedemption, calculateRewardPolicy } from './reward-policy-engine';

async function readBasket(tx: Prisma.TransactionClient, items: PolicyBasketScenarioDto['items']) {
  const products = await tx.product.findMany({
    where: {
      slug: { in: items.map(({ productSlug }) => productSlug) },
      status: 'ACTIVE',
      deletedAt: null,
    },
    select: {
      id: true,
      slug: true,
      salePriceToman: true,
      categories: {
        where: { category: { isActive: true, deletedAt: null } },
        select: { categoryId: true },
      },
      variants: {
        where: {
          sku: { in: items.flatMap(({ variantSku }) => (variantSku ? [variantSku] : [])) },
          isActive: true,
          deletedAt: null,
          OR: [
            { sizeId: null },
            {
              size: { isActive: true, deletedAt: null, group: { isActive: true, deletedAt: null } },
            },
          ],
        },
        select: { id: true, sku: true, salePriceToman: true },
      },
    },
  });
  const bySlug = new Map(products.map((product) => [product.slug, product]));
  return items.map(({ productSlug, variantSku, quantity }) => {
    const product = bySlug.get(productSlug);
    const variant = product?.variants.find(({ sku }) => sku === variantSku);
    if (!product || (variantSku && !variant))
      throw new BadRequestException('کالا یا واریانت نمونه فعال نیست یا یافت نشد.');
    const unitSalePriceToman = variant?.salePriceToman ?? product.salePriceToman;
    if (unitSalePriceToman === null || unitSalePriceToman < 0)
      throw new BadRequestException('قیمت جاری کالای نمونه تنظیم نشده است.');
    return {
      productSlug,
      ...(variantSku ? { variantSku } : {}),
      defaultPriceToman: product.salePriceToman,
      unitSalePriceToman,
      productId: product.id,
      variantId: variant?.id ?? null,
      categoryIds: product.categories.map(({ categoryId }) => categoryId).sort(),
      quantity,
    };
  });
}

async function quoteCampaign(
  tx: Prisma.TransactionClient,
  lines: readonly PromotionLine[],
  input: PolicyBasketScenarioDto,
  warnings: string[],
) {
  const campaign = input.campaignId
    ? await tx.campaign.findUnique({
        where: { id: input.campaignId },
        include: { promotion: true },
      })
    : null;
  if (input.campaignId && !campaign) throw new NotFoundException('کمپین نمونه یافت نشد.');
  const rule = campaign?.promotion;
  if (!campaign || !rule) {
    if (campaign || input.couponApplied) warnings.push('PROMOTION_MISSING');
    return { campaign, applied: null, remaining: null };
  }
  const budget = await campaignBudget(tx, campaign, rule);
  const remaining = budget.remainingDiscountToman;
  const eligible = lines.filter((line) => isPromotionTarget(campaign, line));
  const at = Date.parse(input.occurredAt);
  if (
    campaign.archivedAt ||
    campaign.status !== 'ACTIVE' ||
    at < +campaign.startsAt ||
    at >= +campaign.endsAt
  )
    warnings.push('CAMPAIGN_NOT_ACTIVE_AT_SAMPLE_TIME');
  let reason: string | null = null;
  const hasPaidOrder = input.previousCompletedPurchases > 0 || input.hadPriorPaidOrder === true;
  if (!remaining) reason = 'CAMPAIGN_BUDGET_EXHAUSTED';
  else if (budget.remainingUses === 0) reason = 'CAMPAIGN_USE_LIMIT';
  else if (Boolean(rule.couponCode) !== input.couponApplied) reason = 'CAMPAIGN_COUPON_MISMATCH';
  else if (!matchesPromotionAudience(campaign.audience, hasPaidOrder)) reason = 'CAMPAIGN_AUDIENCE';
  else if (
    (rule.couponCode || campaign.audience === 'FIRST_PURCHASE') &&
    input.promotionPreviouslyRedeemed
  )
    reason = 'CAMPAIGN_CUSTOMER_USE_LIMIT';
  else if (budget.blockers.length) reason = 'CAMPAIGN_CONDITIONS';
  const amounts = reason
    ? null
    : calculatePromotion(rule, eligible, input.shippingToman, remaining);
  if (!amounts) {
    warnings.push(reason ?? 'CAMPAIGN_CONDITIONS');
    return { campaign, applied: null, remaining };
  }
  const quotaLines =
    rule.kind === 'BUNDLE'
      ? eligible.filter(({ productId }) => rule.bundleProductIds.includes(productId))
      : eligible;
  if (!(await planQuotaAllocations(tx, campaign.id, quotaLines))) {
    warnings.push('CAMPAIGN_QUOTA_EXHAUSTED');
    return { campaign, applied: null, remaining };
  }
  const uncapped = calculatePromotion(rule, eligible, input.shippingToman, TOMAN_INT_MAX);
  if (uncapped && uncapped.merchandiseDiscountToman > amounts.merchandiseDiscountToman)
    warnings.push('CAMPAIGN_BUDGET_LIMIT');
  const eligibleLines = new Set(eligible);
  const overrides =
    rule.kind === 'PERCENT' ? readPercentageOverrides(rule.percentageOverrides) : [];
  return {
    campaign,
    remaining,
    applied: {
      ...amounts,
      ...(overrides.length
        ? {
            merchandiseDiscountWeights: percentageDiscountWeights(rule.value, overrides, lines).map(
              (weight, index) => (eligibleLines.has(lines[index]) ? weight : 0),
            ),
          }
        : {}),
      rule: {
        coupon: Boolean(rule.couponCode),
        kind: rule.kind,
        eligibleProductIds: eligible.map(({ productId }) => productId),
        bundleProductIds: rule.bundleProductIds,
      },
    },
  };
}

async function referralScenario(
  tx: Prisma.TransactionClient,
  input: PolicyBasketScenarioDto,
  warnings: string[],
) {
  if (!input.referral) return null;
  const { version, riskVersion, metrics, referrerHasPurchased } = input.referral;
  if (
    metrics.some(
      ({ code, value }) =>
        (code === 'SELF_REFERRAL' && value > 1) ||
        ((code === 'SHARED_ADDRESS' || code === 'SHARED_RECIPIENT') && value > 100),
    )
  )
    throw new BadRequestException('مقدار سیگنال معرفی خود یا شباهت معتبر نیست.');
  const [policy, riskPolicy] = await Promise.all([
    tx.referralRewardPolicyVersion.findUnique({ where: { version }, select: { definition: true } }),
    riskVersion
      ? tx.referralRiskPolicyVersion.findUnique({ where: { version: riskVersion } })
      : tx.referralRiskPolicyVersion.findFirst({ orderBy: { version: 'desc' } }),
  ]);
  if (!policy || (riskVersion && !riskPolicy))
    throw new NotFoundException('نسخهٔ سیاست معرفی یا ریسک یافت نشد.');
  const definitions = policy.definition as unknown as ReferralRewardDefinitionDto;
  if (
    input.referral.usage.some(
      ({ ruleCode }) => !definitions.rules.some(({ code }) => code === ruleCode),
    ) ||
    input.referral.usage.reduce((sum, { committedToman }) => sum + BigInt(committedToman), 0n) >
      BigInt(input.referral.programCommittedToman)
  )
    throw new BadRequestException('مصرف قانون‌های معرفی باید در تعهد کل برنامه لحاظ شود.');
  const risk = assessReferralRisk(
    riskPolicy
      ? (riskPolicy.definition as unknown as ReferralRiskPolicyDto)
      : defaultReferralRiskPolicy(),
    Object.fromEntries(metrics.map(({ code, value }) => [code, value])),
    '',
    new Date(input.occurredAt),
  );
  const eligible =
    referrerHasPurchased &&
    input.previousCompletedPurchases === 0 &&
    !metrics.some(({ code, value }) => code === 'SELF_REFERRAL' && value === 1);
  if (!eligible) warnings.push('REFERRAL_NOT_ELIGIBLE');
  if (risk.action !== 'ALLOW') warnings.push('REFERRAL_RISK_' + risk.action);
  return { definitions, eligible, risk, riskVersion: riskPolicy?.version ?? null };
}

export async function evaluatePolicyBasket(
  tx: Prisma.TransactionClient,
  policy: RewardPolicyDetailDto,
  input: PolicyBasketScenarioDto,
): Promise<PolicyBasketResultDto> {
  const warnings: string[] = [];
  const lines = await readBasket(tx, input.items);
  const merchandise = lines.map(
    ({ unitSalePriceToman, quantity }) => unitSalePriceToman * quantity,
  );
  const merchandiseToman = merchandise.reduce((total, price) => total + price, 0);
  if (merchandiseToman + input.shippingToman > TOMAN_INT_MAX)
    throw new BadRequestException('مبلغ سبد نمونه از سقف تومان پشتیبانی‌شده بیشتر است.');
  const { campaign, applied, remaining } = await quoteCampaign(tx, lines, input, warnings);
  const couponApplied = applied?.rule.coupon ?? false;
  const merchandiseDiscountToman = applied?.merchandiseDiscountToman ?? 0;
  const shippingDiscountToman = applied?.shippingDiscountToman ?? 0;
  const discountLines = allocateCheckoutDiscount(lines, applied);
  const checkoutPayable =
    merchandiseToman + input.shippingToman - merchandiseDiscountToman - shippingDiscountToman;
  const cashCap = (payable: number) => Math.max(0, payable - MIN_WALLET_CASH_PAYMENT_TOMAN);
  const referralContext = await referralScenario(tx, input, warnings);
  const referralLines = lines.map(({ categoryIds }, index) => ({
    categoryIds,
    eligibleToman: merchandise[index] - discountLines[index],
  }));
  const referralSample: ReferralRewardSampleDto = {
    occurredAt: input.occurredAt,
    purchaseRank: input.previousCompletedPurchases + 1,
    confirmed: referralContext?.eligible === true && input.outcome === 'PAID',
    couponApplied,
    purchaseRewardApplied: false,
    campaignId: applied ? (campaign?.id ?? null) : null,
    lines: referralLines,
    usage: input.referral?.usage ?? [],
    programCommittedToman: input.referral?.programCommittedToman ?? 0,
    remainingIncentiveToman: cashCap(checkoutPayable),
  };
  const includeRules = (recipient: 'REFERRED' | 'REFERRER') =>
    referralContext?.definitions.rules.filter(
      (rule) =>
        rule.recipient === recipient &&
        (recipient === 'REFERRER' || rule.expiryDays > (input.referral?.claimAgeDays ?? 0)),
    ) ?? [];
  const referralPreview = (recipient: 'REFERRED' | 'REFERRER', sample: ReferralRewardSampleDto) => {
    if (!referralContext) return null;
    const rules = includeRules(recipient);
    return (
      evaluateReferralRewards(
        {
          ...referralContext.definitions,
          enabled: referralContext.definitions.enabled && rules.some(({ enabled }) => enabled),
          rules,
        },
        {
          ...sample,
          usage: sample.usage.filter(({ ruleCode }) => rules.some(({ code }) => code === ruleCode)),
        },
      ).recipients.find((row) => row.recipient === recipient) ?? null
    );
  };
  const referred = referralPreview('REFERRED', {
    ...referralSample,
    confirmed:
      referralContext?.eligible === true &&
      (input.outcome === 'PAID' || input.outcome === 'UNPAID'),
  });
  const referredRule = includeRules('REFERRED').find(({ code }) => code === referred?.ruleCode);
  if (referred?.reason === 'NO_MATCH') warnings.push('REFERRAL_RULE_CONDITIONS');
  if (input.referral && !includeRules('REFERRED').length)
    warnings.push('REFERRAL_NO_UNEXPIRED_BUYER_RULE');
  const referralDiscountToman = Math.min(referred?.amountToman ?? 0, referred?.eligibleToman ?? 0);
  const scope = new Set(referredRule?.allowedCategoryIds.map((id) => id.toLowerCase()));
  const referralDiscounts = allocateCheckoutToman(
    referralDiscountToman,
    referralLines.map(({ eligibleToman, categoryIds }) =>
      !scope.size || categoryIds.some((id) => scope.has(id.toLowerCase())) ? eligibleToman : 0,
    ),
  );
  const rewardLines = lines.map(({ productId, categoryIds }, index) => ({
    productId,
    categoryIds,
    merchandiseToman: merchandise[index],
    directDiscountToman: discountLines[index] + referralDiscounts[index],
    settledCreditToman: 0,
    refundedCashToman: 0,
  }));
  const redemptionCap = cashCap(checkoutPayable - referralDiscountToman);
  const canRedeem = input.outcome === 'PAID' || input.outcome === 'UNPAID';
  const redemption = calculateRedemption(
    policy.definition,
    rewardLines,
    couponApplied,
    input.availableCreditToman,
    redemptionCap,
  );
  const walletToman = canRedeem ? redemption.maximumToman : 0;
  if (input.availableCreditToman > 0 && walletToman === 0)
    warnings.push(
      couponApplied && !policy.definition.redemptionEligibility.allowCoupon
        ? 'WALLET_COUPON_EXCLUDED'
        : 'WALLET_LIMIT',
    );
  const walletLines = allocateCheckoutToman(walletToman, redemption.weights);
  const reward = calculateRewardPolicy(policy.version, policy.definition, {
    lines: rewardLines.map((line, index) => ({ ...line, settledCreditToman: walletLines[index] })),
    outcome: input.outcome,
    previousCompletedPurchases: input.previousCompletedPurchases,
    couponApplied,
    shippingDiscountToman,
    otherOrderIncentivesToman: 0,
    availableCreditToman: input.availableCreditToman,
    campaignRedemptionCapToman: redemptionCap,
    usage: input.usage,
  });
  if (referralDiscountToman && referredRule?.allowPurchaseReward === false) {
    reward.estimatedRewardToman = 0;
    warnings.push('PURCHASE_REWARD_REFERRAL_EXCLUDED');
  }
  if (reward.existingIncentivesExceedLimit) warnings.push('INCENTIVE_LIMIT_EXCEEDED');
  else if (reward.estimatedRewardToman < reward.calculatedRewardToman)
    warnings.push('PURCHASE_REWARD_LIMIT');
  const remainingBudget = policy.definition.budget;
  const incentives = reward.existingOrderIncentivesToman + reward.estimatedRewardToman;
  const readyForReferrer = input.referral?.delivered === true && !input.referral.returnPending;
  if (referralSample.confirmed && !readyForReferrer)
    warnings.push(
      input.referral?.returnPending ? 'REFERRAL_RETURN_PENDING' : 'REFERRAL_DELIVERY_PENDING',
    );
  const referrer = referralPreview('REFERRER', {
    ...referralSample,
    confirmed:
      referralSample.confirmed &&
      readyForReferrer &&
      policy.enabled &&
      referralContext?.risk.action === 'ALLOW',
    purchaseRewardApplied: reward.estimatedRewardToman > 0,
    programCommittedToman: Math.min(
      Number.MAX_SAFE_INTEGER,
      referralSample.programCommittedToman + referralDiscountToman,
    ),
    lines: referralLines.map((line, index) => ({
      ...line,
      eligibleToman: line.eligibleToman - referralDiscounts[index] - walletLines[index],
    })),
    remainingIncentiveToman: Math.max(
      0,
      Math.min(
        applied && remaining !== null
          ? remaining - merchandiseDiscountToman - shippingDiscountToman
          : TOMAN_INT_MAX,
        remainingBudget.incentivesPerOrderToman - incentives,
        remainingBudget.incentivesPerPeriodToman - input.usage.periodIncentivesToman - incentives,
        remainingBudget.incentivesPerCustomerPeriodToman -
          (input.referral?.referrerIncentivesToman ?? 0),
      ),
    ),
  });
  if (referrer?.reason === 'NO_MATCH') warnings.push('REFERRER_RULE_CONDITIONS');
  if (referred?.reason === 'BUDGET_LIMIT' || referrer?.reason === 'BUDGET_LIMIT')
    warnings.push('REFERRAL_BUDGET_LIMIT');
  const recipients = [
    ...(referred ? [{ ...referred, amountToman: referralDiscountToman }] : []),
    ...(referrer ? [referrer] : []),
  ];
  return {
    items: lines.map(
      ({ productSlug, variantSku, quantity, defaultPriceToman, unitSalePriceToman }, index) => ({
        productSlug,
        ...(variantSku ? { variantSku } : {}),
        quantity,
        defaultPriceToman,
        unitPriceToman: unitSalePriceToman,
        merchandiseDiscountToman: discountLines[index],
        referralDiscountToman: referralDiscounts[index],
        walletToman: walletLines[index],
      }),
    ),
    merchandiseToman,
    merchandiseDiscountToman,
    shippingToman: input.shippingToman,
    shippingDiscountToman,
    referralDiscountToman,
    walletToman,
    payableToman: checkoutPayable - referralDiscountToman - walletToman,
    activationDelayDays:
      policy.definition.activationDelayDays ?? DEFAULT_REWARD_ACTIVATION_DELAY_DAYS,
    campaignRevision: campaign?.revision ?? null,
    promotionVersion: campaign?.promotion?.version ?? null,
    remainingCampaignBudgetToman: remaining,
    reward,
    referral: referralContext
      ? {
          recipients,
          totalToman: recipients.reduce((total, row) => total + row.amountToman, 0),
        }
      : null,
    risk: referralContext?.risk ?? null,
    resolvedRiskVersion: referralContext?.riskVersion ?? null,
    warnings,
    reviewId: null,
  };
}
