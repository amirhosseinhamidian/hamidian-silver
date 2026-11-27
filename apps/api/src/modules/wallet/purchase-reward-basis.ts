import type { Prisma } from '../../generated/prisma/client';
import type { RewardSampleLineDto } from '../reward-policies/dto/reward-policy.dto';
import { allocateCheckoutToman, returnedLineCredit } from './wallet-checkout';

export type PurchaseRewardBasis = {
  couponApplied: boolean;
  referralAllowsPurchaseReward?: boolean;
  shippingDiscountToman: number;
  items: Array<{
    variantId: string;
    platingType: string | null;
    productId: string;
    categoryIds: string[];
    directDiscountToman: number;
  }>;
};

type Merchandise = Pick<
  RewardSampleLineDto,
  'productId' | 'categoryIds' | 'directDiscountToman'
> & {
  quantity: number;
  returnedQuantity: number;
  unitSalePriceToman: number;
  walletAppliedToman: number;
};

export const purchaseRewardOrderSelect = {
  id: true,
  userId: true,
  status: true,
  paidAt: true,
  deliveredAt: true,
  discountTotalToman: true,
  purchaseRewardBasis: true,
  payment: { select: { status: true, refundedAmountToman: true } },
  priceQuote: { select: { snapshot: true, shippingDiscountToman: true } },
  items: {
    orderBy: { id: 'asc' },
    select: {
      variantId: true,
      platingType: true,
      quantity: true,
      returnedQuantity: true,
      unitSalePriceToman: true,
      walletAppliedToman: true,
      variant: {
        select: {
          productId: true,
          product: {
            select: {
              categories: {
                where: { category: { isActive: true, deletedAt: null } },
                select: { categoryId: true },
              },
            },
          },
        },
      },
    },
  },
  returns: { where: { status: 'REQUESTED' }, take: 1, select: { id: true } },
} satisfies Prisma.OrderSelect;

export type PurchaseRewardOrder = Prisma.OrderGetPayload<{
  select: typeof purchaseRewardOrderSelect;
}>;

export function isRewardablePurchase(order: PurchaseRewardOrder) {
  return (
    order.paidAt !== null &&
    (order.payment?.status === 'PAID' || order.payment?.status === 'PARTIALLY_REFUNDED') &&
    order.status !== 'CANCELLED' &&
    order.status !== 'EXPIRED' &&
    order.items.some(({ returnedQuantity, quantity }) => returnedQuantity < quantity)
  );
}

export function resolvePurchaseRewardBasis(order: PurchaseRewardOrder): PurchaseRewardBasis {
  if (order.purchaseRewardBasis) return order.purchaseRewardBasis as unknown as PurchaseRewardBasis;

  // Orders created before the migration can still be paid. Prefer their signed quote.
  type Quote = {
    rule?: {
      coupon?: boolean;
      kind?: string;
      eligibleProductIds?: string[];
      bundleProductIds?: string[];
    } | null;
    items?: PurchaseRewardBasis['items'];
  };
  const quote = order.priceQuote?.snapshot as Quote | null | undefined;
  const snapshotItems = new Map(quote?.items?.map((item) => [itemKey(item), item]));
  const weights = order.items.map(({ variant, unitSalePriceToman, quantity }) => {
    const rule = quote?.rule;
    const eligible =
      (!rule?.eligibleProductIds || rule.eligibleProductIds.includes(variant.productId)) &&
      (rule?.kind !== 'BUNDLE' || rule.bundleProductIds?.includes(variant.productId));
    return eligible ? unitSalePriceToman * quantity : 0;
  });
  const discounts = allocateCheckoutToman(order.discountTotalToman, weights);
  return {
    couponApplied: quote?.rule?.coupon ?? false,
    shippingDiscountToman: order.priceQuote?.shippingDiscountToman ?? 0,
    items: order.items.map((item, index) => {
      const snapshot = snapshotItems.get(itemKey(item));
      return {
        variantId: item.variantId,
        platingType: item.platingType,
        productId: snapshot?.productId ?? item.variant.productId,
        categoryIds:
          snapshot?.categoryIds ??
          item.variant.product.categories.map(({ categoryId }) => categoryId),
        directDiscountToman: snapshot?.directDiscountToman ?? discounts[index],
      };
    }),
  };
}

function itemKey(item: { variantId: string; platingType: string | null }) {
  return `${item.variantId}:${item.platingType}`;
}

export function rewardLinesForOrder(order: PurchaseRewardOrder, basis: PurchaseRewardBasis) {
  const snapshot = new Map(basis.items.map((line) => [itemKey(line), line]));
  const lines = order.items.map((item) => {
    const line = snapshot.get(itemKey(item));
    if (!line) throw new Error('Purchase reward basis is missing an order item.');
    return { ...item, ...line };
  });
  return purchaseRewardLines(lines, order.payment?.refundedAmountToman ?? 0);
}

export function purchaseRewardLines(
  lines: readonly Merchandise[],
  confirmedRefundToman: number,
): RewardSampleLineDto[] {
  const merchandise = lines.map(
    ({ unitSalePriceToman, quantity }) => unitSalePriceToman * quantity,
  );
  const cash = lines.map(
    (line, index) => merchandise[index] - line.directDiscountToman - line.walletAppliedToman,
  );
  const returned = lines.map((line, index) =>
    returnedLineCredit(cash[index], line.quantity, 0, line.returnedQuantity),
  );
  const outstanding = cash.map((amount, index) => amount - returned[index]);
  // A cash refund can settle the same physical return. Only allocate the excess against retained items.
  const extraRefund = Math.min(
    outstanding.reduce((total, amount) => total + amount, 0),
    Math.max(0, confirmedRefundToman - returned.reduce((total, amount) => total + amount, 0)),
  );
  const allocated = allocateCheckoutToman(extraRefund, outstanding);
  return lines.map((line, index) => ({
    productId: line.productId,
    categoryIds: line.categoryIds,
    merchandiseToman: merchandise[index],
    directDiscountToman: line.directDiscountToman,
    settledCreditToman: line.walletAppliedToman,
    refundedCashToman: returned[index] + allocated[index],
  }));
}
