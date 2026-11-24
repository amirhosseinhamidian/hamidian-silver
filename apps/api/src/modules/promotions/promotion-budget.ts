import type { Campaign, Prisma } from '../../generated/prisma/client';

export const countedPromotionOrders = {
  OR: [{ status: { notIn: ['CANCELLED', 'EXPIRED'] } }, { paidAt: { not: null } }],
} satisfies Prisma.OrderWhereInput;

export function discountBudget(
  campaign: Pick<Campaign, 'budgetToman' | 'plannedChannelCostToman'>,
) {
  return campaign.budgetToman - (campaign.plannedChannelCostToman ?? 0);
}

export function committedDiscount(usage: {
  _sum: { merchandiseDiscountToman: number | null; shippingDiscountToman: number | null };
}) {
  return (usage._sum.merchandiseDiscountToman ?? 0) + (usage._sum.shippingDiscountToman ?? 0);
}

export function committedCampaignIncentives(usage: {
  _sum: {
    merchandiseDiscountToman: number | null;
    shippingDiscountToman: number | null;
    referralRewardToman?: number | null;
  };
}) {
  return committedDiscount(usage) + (usage._sum.referralRewardToman ?? 0);
}

export function promotionUsage(
  tx: Prisma.TransactionClient,
  campaignId: string,
  order: Prisma.OrderWhereInput = {},
) {
  return tx.orderPriceQuote.aggregate({
    where: { campaignId, order: { ...order, ...countedPromotionOrders } },
    _sum: {
      merchandiseDiscountToman: true,
      shippingDiscountToman: true,
      referralRewardToman: true,
    },
    _count: { _all: true },
  });
}
