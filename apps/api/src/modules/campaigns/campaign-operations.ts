import { BadRequestException } from '@nestjs/common';
import { TOMAN_INT_MAX } from '../../common/toman';
import type { Campaign, CampaignPromotion, Prisma } from '../../generated/prisma/client';
import {
  committedCampaignIncentives,
  committedDiscount,
  discountBudget,
  promotionUsage,
} from '../promotions/promotion-budget';
import {
  calculatePromotion,
  isPromotionTarget,
  matchesPromotionAudience,
} from '../promotions/promotion-engine';
import type {
  CampaignBudgetDto,
  CampaignSimulationDto,
  CampaignSimulationInputDto,
} from './dto/campaign-operations.dto';

const activeProduct = { status: 'ACTIVE', deletedAt: null } satisfies Prisma.ProductWhereInput;

type CampaignProduct = {
  id: string;
  slug: string;
  categories: Array<{ categoryId: string }>;
};

async function campaignProducts(tx: Prisma.TransactionClient, where: Prisma.ProductWhereInput) {
  return tx.product.findMany({
    where: { ...activeProduct, ...where },
    select: {
      id: true,
      slug: true,
      categories: {
        where: { category: { isActive: true, deletedAt: null } },
        select: { categoryId: true },
      },
    },
  });
}

function productTarget({ id, categories }: CampaignProduct) {
  return { productId: id, categoryIds: categories.map(({ categoryId }) => categoryId) };
}

export async function campaignBudget(
  tx: Prisma.TransactionClient,
  campaign: Campaign,
  rule: CampaignPromotion | null,
  options: { warnings?: boolean } = {},
): Promise<CampaignBudgetDto> {
  const discountBudgetToman = discountBudget(campaign);
  const usage = rule ? await promotionUsage(tx, campaign.id) : null;
  const committedDiscountToman = usage ? committedDiscount(usage) : 0;
  const committedReferralRewardToman = usage?._sum.referralRewardToman ?? 0;
  const remainingDiscountToman = Math.max(
    0,
    discountBudgetToman - (usage ? committedCampaignIncentives(usage) : 0),
  );
  const usedOrders = usage?._count._all ?? 0;
  const remainingUses = rule?.maxUses == null ? null : Math.max(0, rule.maxUses - usedOrders);
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (!rule && campaign.audience !== 'ALL_CUSTOMERS')
    blockers.push('Configure a promotion for the selected audience.');
  if (rule) {
    if (remainingDiscountToman === 0)
      blockers.push('No discount budget remains for this campaign.');
    if (remainingUses === 0) blockers.push('The promotion has reached its redemption limit.');
    if (rule.kind === 'BUNDLE') {
      const products = await campaignProducts(tx, { id: { in: rule.bundleProductIds } });
      if (
        products.length !== rule.bundleProductIds.length ||
        products.some((product) => !isPromotionTarget(campaign, productTarget(product)))
      )
        blockers.push('Choose active bundle products in the campaign scope.');
    }
    if (options.warnings) {
      if (rule.maxDiscountToman > remainingDiscountToman)
        warnings.push('The remaining budget can reduce the discount below its per-order cap.');
      if (rule.kind === 'PERCENT' && rule.value > rule.maxDiscountBps)
        warnings.push('The percentage cap reduces the configured discount rate.');
      if (rule.couponCode === null && (await hasConcurrentPromotion(tx, campaign))) {
        warnings.push('An automatic promotion overlaps this period. Only one rule can apply.');
      }
    }
  }
  return {
    discountBudgetToman,
    committedDiscountToman,
    ...(committedReferralRewardToman ? { committedReferralRewardToman } : {}),
    remainingDiscountToman,
    usedOrders,
    remainingUses,
    blockers,
    warnings,
  };
}

async function hasConcurrentPromotion(tx: Prisma.TransactionClient, campaign: Campaign) {
  return tx.campaignPromotion.findFirst({
    where: {
      couponCode: null,
      campaign: {
        id: { not: campaign.id },
        status: { in: ['APPROVED', 'SCHEDULED', 'ACTIVE'] },
        startsAt: { lt: campaign.endsAt },
        endsAt: { gt: campaign.startsAt },
        ...(campaign.audience === 'ALL_CUSTOMERS'
          ? {}
          : { audience: { in: ['ALL_CUSTOMERS', campaign.audience] } }),
      },
    },
    select: { campaignId: true },
  });
}

export async function simulateCampaign(
  tx: Prisma.TransactionClient,
  campaign: Campaign,
  rule: CampaignPromotion | null,
  input: CampaignSimulationInputDto,
): Promise<CampaignSimulationDto> {
  const merchandiseToman = input.items.reduce(
    (total, { quantity, unitSalePriceToman }) => total + quantity * unitSalePriceToman,
    0,
  );
  if (merchandiseToman + input.shippingToman > TOMAN_INT_MAX)
    throw new BadRequestException('The sample basket total exceeds the allowed amount.');
  const products = await campaignProducts(tx, {
    slug: { in: input.items.map(({ slug }) => slug) },
  });
  const bySlug = new Map(products.map((product) => [product.slug, product]));
  const lines = input.items.map(({ slug, quantity, unitSalePriceToman }) => {
    const product = bySlug.get(slug);
    if (!product) throw new BadRequestException('Choose available products for the sample basket.');
    return { ...productTarget(product), quantity, unitSalePriceToman };
  });
  const eligible = lines.filter((line) => isPromotionTarget(campaign, line));
  const eligibleSubtotalToman = eligible.reduce(
    (total, { quantity, unitSalePriceToman }) => total + quantity * unitSalePriceToman,
    0,
  );
  const budget = await campaignBudget(tx, campaign, rule);
  const reason =
    budget.blockers[0] ??
    (!rule
      ? 'No promotion has been saved for this campaign.'
      : !matchesPromotionAudience(campaign.audience, input.hasPaidOrder)
        ? 'The sample customer is outside the promotion audience.'
        : null);
  const amounts =
    rule && !reason
      ? calculatePromotion(rule, eligible, input.shippingToman, budget.remainingDiscountToman)
      : null;
  const merchandiseDiscountToman = amounts?.merchandiseDiscountToman ?? 0;
  const shippingDiscountToman = amounts?.shippingDiscountToman ?? 0;
  return {
    merchandiseToman,
    eligibleSubtotalToman,
    shippingToman: input.shippingToman,
    merchandiseDiscountToman,
    shippingDiscountToman,
    payableToman:
      merchandiseToman + input.shippingToman - merchandiseDiscountToman - shippingDiscountToman,
    reason: amounts
      ? null
      : (reason ?? 'The sample basket does not meet the promotion conditions.'),
  };
}
