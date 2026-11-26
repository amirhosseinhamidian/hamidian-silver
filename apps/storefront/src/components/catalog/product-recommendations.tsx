'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

import { CatalogProductCard } from '@/components/catalog/catalog-product-card';
import { measureCatalogProducts } from '@/lib/analytics/commerce-events';
import type {
  PublicCatalogProductList,
  PublicCatalogProductSummary,
} from '@/lib/catalog/public-catalog';

type List = 'product_recommendations' | 'cart_recommendations' | 'campaign_recommendations';
const titles: Record<List, string> = {
  product_recommendations: 'پیشنهادهای مکمل این محصول',
  cart_recommendations: 'پیشنهادهای مکمل سبد شما',
  campaign_recommendations: 'پیشنهادهای مکمل',
};

export function RecommendationCards({
  list,
  items,
  children,
}: Readonly<{ list: List; items: readonly PublicCatalogProductSummary[]; children?: ReactNode }>) {
  const titleId = useId();
  const grid = useRef<HTMLUListElement>(null);
  const seen = useRef(new Set<string>());

  useEffect(() => {
    if (!grid.current || typeof IntersectionObserver === 'undefined') return;
    const products = new Map(items.map((item) => [item.id, item]));
    const observer = new IntersectionObserver(
      (entries) => {
        const visible: PublicCatalogProductSummary[] = [];
        for (const { isIntersecting, target } of entries) {
          const product = products.get(target.getAttribute('data-recommendation') ?? '');
          if (!isIntersecting || !product || seen.current.has(product.id)) continue;
          seen.current.add(product.id);
          observer.unobserve(target);
          visible.push(product);
        }
        if (visible.length) measureCatalogProducts('view_item_list', list, visible);
      },
      { threshold: 0.2 },
    );
    for (const card of grid.current.querySelectorAll('[data-recommendation]')) {
      if (!seen.current.has(card.getAttribute('data-recommendation') ?? '')) observer.observe(card);
    }
    return () => observer.disconnect();
  }, [items, list]);

  if (!items.length) return null;
  return (
    <section aria-labelledby={titleId} className="mt-10 sm:mt-14">
      <h2 id={titleId} className="text-xl font-medium sm:text-2xl">
        {titles[list]}
      </h2>
      <ul ref={grid} className="mt-5 grid grid-cols-2 gap-x-3 gap-y-6 sm:gap-x-5 lg:grid-cols-4">
        {items.map((product) => (
          <CatalogProductCard
            key={product.id}
            product={product}
            recommendationId={product.id}
            onSelect={() => measureCatalogProducts('select_item', list, [product])}
          />
        ))}
      </ul>
      {children}
    </section>
  );
}

export function ProductRecommendations({
  list,
  sources,
  excluded = [],
}: Readonly<{
  list: Exclude<List, 'product_recommendations'>;
  sources: readonly string[];
  excluded?: readonly string[];
}>) {
  const request = JSON.stringify([...new Set(sources)].slice(0, 3));
  const [loaded, setLoaded] = useState<{
    request: string;
    items: PublicCatalogProductSummary[];
  } | null>(null);

  useEffect(() => {
    const slugs = JSON.parse(request) as string[];
    if (!slugs.length) return;
    const controller = new AbortController();
    void Promise.allSettled(
      slugs.map(async (slug) => {
        const response = await fetch(
          `/api/catalog/products/${encodeURIComponent(slug)}/related?pageSize=8`,
          { signal: controller.signal },
        );
        return response.ok ? ((await response.json()) as PublicCatalogProductList).items : [];
      }),
    ).then((results) => {
      if (controller.signal.aborted) return;
      const items = results.flatMap((result) =>
        result.status === 'fulfilled' ? result.value : [],
      );
      setLoaded({ request, items });
    });
    return () => controller.abort();
  }, [request]);

  const included = new Set([...excluded, ...sources]);
  const items: PublicCatalogProductSummary[] = [];
  for (const product of loaded?.request === request ? loaded.items : []) {
    if (!product.isAvailable || included.has(product.slug)) continue;
    included.add(product.slug);
    items.push(product);
    if (items.length === 4) break;
  }

  return <RecommendationCards list={list} items={items} />;
}
