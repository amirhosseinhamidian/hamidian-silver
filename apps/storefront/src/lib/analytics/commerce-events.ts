'use client';

import {
  ANALYTICS_CURRENCY,
  trackAnalyticsEvent,
  tomanToIrr,
  type AnalyticsItem,
} from '@/lib/analytics/analytics';

export type CommerceItemInput = Readonly<{
  itemId: string;
  itemName: string;
  brand?: string | null;
  category?: string | null;
  variant?: string | null;
  priceToman?: number | null;
  quantity?: number;
}>;

export type PurchaseInput = Readonly<{
  transactionId: string;
  valueToman: number;
  shippingToman: number;
  taxToman: number;
  items: readonly CommerceItemInput[];
}>;

export function toAnalyticsItem(item: CommerceItemInput): AnalyticsItem {
  return {
    item_id: item.itemId,
    item_name: item.itemName,
    ...(item.brand ? { item_brand: item.brand } : {}),
    ...(item.category ? { item_category: item.category } : {}),
    ...(item.variant ? { item_variant: item.variant } : {}),
    ...(item.priceToman === null || item.priceToman === undefined
      ? {}
      : { price: tomanToIrr(item.priceToman) }),
    ...(item.quantity === undefined ? {} : { quantity: item.quantity }),
  };
}

function trackItemEvent(
  eventName: 'view_item' | 'add_to_wishlist' | 'remove_from_wishlist' | 'add_to_cart',
  item: CommerceItemInput,
): boolean {
  return trackAnalyticsEvent(eventName, {
    currency: ANALYTICS_CURRENCY,
    ...(item.priceToman === null || item.priceToman === undefined
      ? {}
      : { value: tomanToIrr(item.priceToman) * (item.quantity ?? 1) }),
    items: [toAnalyticsItem(item)],
  });
}

export function trackProductView(item: CommerceItemInput): boolean {
  return trackItemEvent('view_item', item);
}

export function trackWishlistChange(item: CommerceItemInput, added: boolean): boolean {
  return trackItemEvent(added ? 'add_to_wishlist' : 'remove_from_wishlist', item);
}

export function trackAddToCart(item: CommerceItemInput): boolean {
  return trackItemEvent('add_to_cart', item);
}

export function trackBeginCheckout(
  valueToman: number,
  items: readonly CommerceItemInput[],
): boolean {
  return trackAnalyticsEvent('begin_checkout', {
    currency: ANALYTICS_CURRENCY,
    value: tomanToIrr(valueToman),
    items: items.map(toAnalyticsItem),
  });
}

export function trackPurchase(purchase: PurchaseInput): boolean {
  return trackAnalyticsEvent('purchase', {
    transaction_id: purchase.transactionId,
    currency: ANALYTICS_CURRENCY,
    value: tomanToIrr(purchase.valueToman),
    shipping: tomanToIrr(purchase.shippingToman),
    tax: tomanToIrr(purchase.taxToman),
    items: purchase.items.map(toAnalyticsItem),
  });
}

export function trackSearch(searchTerm: string, resultCount: number): boolean {
  return trackAnalyticsEvent('search', {
    search_term: searchTerm,
    results_count: resultCount,
  });
}
