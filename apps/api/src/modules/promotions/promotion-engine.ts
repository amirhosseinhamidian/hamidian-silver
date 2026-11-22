import type { Campaign, CampaignAudience, CampaignPromotion } from '../../generated/prisma/client';

export function matchesPromotionAudience(audience: CampaignAudience, hasPaidOrder?: boolean) {
  return (
    audience === 'ALL_CUSTOMERS' ||
    (audience === 'FIRST_PURCHASE' && hasPaidOrder === false) ||
    (audience === 'RETURNING' && hasPaidOrder === true)
  );
}

export type PromotionLine = Readonly<{
  productId: string;
  categoryIds: readonly string[];
  quantity: number;
  unitSalePriceToman: number;
}>;

type Target = Pick<Campaign, 'allProducts' | 'productIds' | 'categoryIds'>;
type Rule = Pick<
  CampaignPromotion,
  'kind' | 'value' | 'minSubtotalToman' | 'maxDiscountToman' | 'maxDiscountBps' | 'bundleProductIds'
>;

export function isPromotionTarget(
  campaign: Target,
  line: Pick<PromotionLine, 'productId' | 'categoryIds'>,
) {
  return (
    campaign.allProducts ||
    campaign.productIds.includes(line.productId) ||
    line.categoryIds.some((id) => campaign.categoryIds.includes(id))
  );
}

export function calculatePromotion(
  rule: Rule,
  eligible: readonly PromotionLine[],
  shippingToman: number,
  budgetRemainingToman: number,
) {
  const subtotal = eligible.reduce(
    (total, line) => total + line.unitSalePriceToman * line.quantity,
    0,
  );
  if (!eligible.length || subtotal < rule.minSubtotalToman) return null;

  const cap = Math.min(
    rule.maxDiscountToman,
    Math.floor((subtotal * rule.maxDiscountBps) / 10_000),
    budgetRemainingToman,
  );
  if (cap <= 0) return null;

  if (rule.kind === 'FREE_SHIPPING') {
    return shippingToman > 0 && shippingToman <= cap
      ? { merchandiseDiscountToman: 0, shippingDiscountToman: shippingToman }
      : null;
  }

  let discount = rule.value;
  if (rule.kind === 'PERCENT') {
    discount = Math.floor((subtotal * rule.value) / 10_000);
  }
  if (rule.kind === 'BUNDLE') {
    const quantities = new Map<string, number>();
    for (const { productId, quantity } of eligible) {
      quantities.set(productId, (quantities.get(productId) ?? 0) + quantity);
    }
    const bundles = Math.min(...rule.bundleProductIds.map((id) => quantities.get(id) ?? 0));
    discount = bundles > 0 ? bundles * rule.value : 0;
    // A bundle's benefit can only be attributed to its own products.
    const bundleMerchandise = rule.bundleProductIds.reduce((total, productId) => {
      const cheapestUnits = eligible
        .filter((line) => line.productId === productId)
        .sort((left, right) => left.unitSalePriceToman - right.unitSalePriceToman);
      let unitsLeft = bundles;
      for (const line of cheapestUnits) {
        const units = Math.min(unitsLeft, line.quantity);
        total += units * line.unitSalePriceToman;
        unitsLeft -= units;
      }
      return total;
    }, 0);
    discount = Math.min(discount, Math.floor((bundleMerchandise * rule.maxDiscountBps) / 10_000));
  }

  const merchandiseDiscountToman = Math.min(discount, cap);
  return merchandiseDiscountToman > 0
    ? { merchandiseDiscountToman, shippingDiscountToman: 0 }
    : null;
}
