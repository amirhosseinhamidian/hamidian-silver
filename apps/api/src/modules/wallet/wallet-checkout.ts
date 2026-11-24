import type { PromotionLine } from '../promotions/promotion-engine';

/** Split an already-calculated amount without floating-point or rounding loss. */
export function allocateCheckoutToman(amount: number, weights: readonly number[]): number[] {
  if (!amount) return weights.map(() => 0);
  const total = BigInt(weights.reduce((sum, weight) => sum + weight, 0));
  let cumulativeWeight = 0n;
  let allocated = 0;
  return weights.map((weight) => {
    cumulativeWeight += BigInt(weight);
    const next = Number((BigInt(amount) * cumulativeWeight) / total);
    const share = next - allocated;
    allocated = next;
    return share;
  });
}

export function returnedLineCredit(
  credit: number,
  units: number,
  previouslyReturned: number,
  received: number,
): number {
  const allocatedThrough = (quantity: number) =>
    (BigInt(credit) * BigInt(quantity)) / BigInt(units);
  return Number(
    allocatedThrough(previouslyReturned + received) - allocatedThrough(previouslyReturned),
  );
}

export type CheckoutPromotion = {
  merchandiseDiscountToman: number;
  rule: { coupon: boolean; kind: string; eligibleProductIds: string[]; bundleProductIds: string[] };
};

export function allocateCheckoutDiscount(
  lines: readonly PromotionLine[],
  promotion?: CheckoutPromotion | null,
) {
  const target = new Set(promotion?.rule.eligibleProductIds);
  const bundle = new Set(promotion?.rule.bundleProductIds);
  const weights = lines.map(({ productId, unitSalePriceToman, quantity }) =>
    target.has(productId) && (promotion?.rule.kind !== 'BUNDLE' || bundle.has(productId))
      ? unitSalePriceToman * quantity
      : 0,
  );
  return allocateCheckoutToman(promotion?.merchandiseDiscountToman ?? 0, weights);
}
