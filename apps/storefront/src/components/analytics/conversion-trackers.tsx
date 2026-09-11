'use client';

import { useEffect, useRef } from 'react';

import {
  trackProductView,
  trackPurchase,
  trackSearch,
  type PurchaseInput,
} from '@/lib/analytics/commerce-events';
import type { PublicCatalogProductDetail } from '@/lib/catalog/public-catalog';

type SearchResultsAnalyticsProps = Readonly<{
  searchTerm?: string;
  resultCount: number;
}>;

export function SearchResultsAnalytics({ searchTerm, resultCount }: SearchResultsAnalyticsProps) {
  const trackedSearch = useRef<string | null>(null);

  useEffect(() => {
    if (!searchTerm || trackedSearch.current === searchTerm) {
      return;
    }

    trackSearch(searchTerm, resultCount);
    trackedSearch.current = searchTerm;
  }, [resultCount, searchTerm]);

  return null;
}

export function ProductViewAnalytics({
  product,
}: Readonly<{ product: PublicCatalogProductDetail }>) {
  const trackedProductId = useRef<string | null>(null);

  useEffect(() => {
    if (trackedProductId.current === product.id) {
      return;
    }

    trackProductView({
      itemId: product.slug,
      itemName: product.name,
      brand: product.brand?.name,
      category: product.categories[0]?.name,
      priceToman: product.salePriceToman,
      quantity: 1,
    });
    trackedProductId.current = product.id;
  }, [product]);

  return null;
}

const PURCHASE_STORAGE_PREFIX = 'hamidian-analytics-purchase-v1:';

type PurchaseAnalyticsProps = PurchaseInput & Readonly<{ orderId: string }>;

export function PurchaseAnalytics({
  orderId,
  transactionId,
  valueToman,
  shippingToman,
  taxToman,
  items,
}: PurchaseAnalyticsProps) {
  const attemptedOrderId = useRef<string | null>(null);

  useEffect(() => {
    if (attemptedOrderId.current === orderId) {
      return;
    }
    attemptedOrderId.current = orderId;

    const storageKey = `${PURCHASE_STORAGE_PREFIX}${orderId}`;

    try {
      if (window.localStorage.getItem(storageKey) === 'sent') {
        return;
      }
    } catch {
      // In-memory deduplication above still protects this render when storage is unavailable.
    }

    const sent = trackPurchase({
      transactionId,
      valueToman,
      shippingToman,
      taxToman,
      items,
    });

    if (sent) {
      try {
        window.localStorage.setItem(storageKey, 'sent');
      } catch {
        // A blocked storage API must not affect the verified payment result.
      }
    }
  }, [items, orderId, shippingToman, taxToman, transactionId, valueToman]);

  return null;
}
