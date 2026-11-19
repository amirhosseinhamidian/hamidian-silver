'use client';

import { useEffect, useRef } from 'react';

import { trackProductView, trackPurchase, trackSearch } from '@/lib/analytics/commerce-events';
import { trackFunnelEvent } from '@/lib/analytics/funnel-tracker';
import type { OrderFunnelRecord } from '@/lib/analytics/order-funnel';
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

    void trackFunnelEvent(
      { name: 'view_item', items: [{ productId: product.slug, quantity: 1 }] },
      {
        publish: () =>
          trackProductView({
            itemId: product.slug,
            itemName: product.name,
            brand: product.brand?.name,
            category: product.categories[0]?.name,
            priceToman: product.salePriceToman,
            quantity: 1,
          }),
      },
    );
    trackedProductId.current = product.id;
  }, [product]);

  return null;
}

export function OrderFunnelAnalytics({
  records,
}: Readonly<{ records: readonly OrderFunnelRecord[] }>) {
  useEffect(() => {
    for (const { event, purchase } of records) {
      void trackFunnelEvent(event, {
        publish: purchase ? () => trackPurchase(purchase) : undefined,
      });
    }
  }, [records]);

  return null;
}
