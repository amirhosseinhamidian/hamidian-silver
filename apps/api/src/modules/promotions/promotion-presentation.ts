import { isNonNegativeTomanInt } from '../../common/toman';
import type { Campaign, CampaignPromotion } from '../../generated/prisma/client';
import type { CatalogCampaignOfferDto, CampaignCondition } from './dto/promotion.dto';
import { calculatePromotion, isPromotionTarget, type PromotionLine } from './promotion-engine';

type ProductTarget = Pick<PromotionLine, 'productId' | 'categoryIds'>;

export type CatalogPromotionCandidate = Pick<
  CampaignPromotion,
  | 'kind'
  | 'value'
  | 'minSubtotalToman'
  | 'maxDiscountToman'
  | 'maxDiscountBps'
  | 'bundleProductIds'
  | 'couponCode'
> & {
  campaign: Pick<
    Campaign,
    'name' | 'allProducts' | 'productIds' | 'categoryIds' | 'audience' | 'endsAt'
  >;
  remainingToman: number;
};

export function selectCatalogPromotion(
  candidates: readonly CatalogPromotionCandidate[],
  target: ProductTarget,
  regularToman: number | null,
): CatalogCampaignOfferDto | null {
  if (regularToman === null || regularToman === 0 || !isNonNegativeTomanInt(regularToman))
    return null;

  const line = { ...target, unitSalePriceToman: regularToman, quantity: 1 };
  let conditional: CatalogCampaignOfferDto | null = null;
  for (const rule of candidates) {
    if (
      rule.remainingToman <= 0 ||
      !isPromotionTarget(rule.campaign, target) ||
      (rule.kind === 'BUNDLE' && !rule.bundleProductIds.includes(target.productId))
    )
      continue;

    const conditions: CampaignCondition[] = [];
    if (rule.couponCode) conditions.push('COUPON');
    if (rule.campaign.audience !== 'ALL_CUSTOMERS') conditions.push('CUSTOMER');
    if (rule.minSubtotalToman > 0) conditions.push('MINIMUM');
    if (rule.kind === 'FIXED' || rule.kind === 'THRESHOLD') conditions.push('ORDER_AMOUNT');
    if (rule.kind === 'BUNDLE') conditions.push('BUNDLE');
    if (rule.kind === 'FREE_SHIPPING') conditions.push('SHIPPING');

    const offer: CatalogCampaignOfferDto = {
      name: rule.campaign.name,
      endsAt: rule.campaign.endsAt.toISOString(),
      conditions,
      minimumToman: rule.minSubtotalToman || null,
      price: null,
    };
    const automatic = !rule.couponCode && rule.campaign.audience === 'ALL_CUSTOMERS';
    const amounts = automatic ? calculatePromotion(rule, [line], 0, rule.remainingToman) : null;
    if (conditions.length) {
      conditional ??= offer;
      // Match Checkout priority if this order-level rule already applies to one unit.
      if (amounts) return offer;
      continue;
    }
    if (!amounts) continue;

    const discountToman = amounts.merchandiseDiscountToman;
    return {
      ...offer,
      price: {
        regularToman,
        discountToman,
        discountPercent: Math.round((discountToman * 100) / regularToman),
        finalToman: regularToman - discountToman,
      },
    };
  }
  return conditional;
}
