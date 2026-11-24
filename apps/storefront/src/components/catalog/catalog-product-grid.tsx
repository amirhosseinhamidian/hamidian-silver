'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { CatalogProductCard } from '@/components/catalog/catalog-product-card';
import { Button } from '@/components/ui/button';
import { trackCatalogEvent } from '@/lib/analytics/commerce-events';
import type { CatalogList } from '@/lib/analytics/funnel-contract';
import { trackFunnelEvent } from '@/lib/analytics/funnel-tracker';
import {
  buildCatalogCollectionHref,
  buildCatalogHref,
  buildFacetedCatalogHref,
  catalogFacetSearchParams,
  hasCatalogFacetFilters,
  type CatalogFacetFilters,
  type CatalogFacetScope,
  type CatalogFilters,
} from '@/lib/catalog/catalog-filter-state';
import type {
  PublicCatalogProductList,
  PublicCatalogProductSummary,
} from '@/lib/catalog/public-catalog';
import { cn } from '@/lib/ui/cn';

type CatalogProductGridProps = Readonly<{
  filters: CatalogFacetFilters;
  initialProducts: PublicCatalogProductList;
  initialFallbackSources?: Readonly<Record<string, string>>;
  imageSizes?: string;
  className?: string;
  paginationPath?: string;
  prioritizeFirstImage?: boolean;
  facetScope?: CatalogFacetScope;
  paused?: boolean;
  campaignRequest?: Readonly<{ pathname: string; query: string }>;
  autoLoad?: boolean;
}>;

let campaignPosition: {
  key: string;
  products: PublicCatalogProductSummary[];
  nextPage: number;
  totalPages: number;
  scrollY: number;
} | null = null;

function buildProductsRequestHref(filters: CatalogFilters, page: number): string {
  const searchParams = new URLSearchParams({ page: String(page) });

  if (filters.q) searchParams.set('q', filters.q);
  if (filters.category) searchParams.set('category', filters.category);
  if (filters.brand) searchParams.set('brand', filters.brand);
  if (filters.country) searchParams.set('country', filters.country);
  if (filters.sort !== 'newest') searchParams.set('sort', filters.sort);

  return `/api/catalog/products?${searchParams.toString()}`;
}

function isProductPage(value: unknown): value is PublicCatalogProductList {
  if (!value || typeof value !== 'object') return false;

  const page = value as Partial<PublicCatalogProductList>;

  return (
    Array.isArray(page.items) &&
    Number.isSafeInteger(page.page) &&
    Number.isSafeInteger(page.pageSize) &&
    Number.isSafeInteger(page.total) &&
    Number.isSafeInteger(page.totalPages)
  );
}

const persianNumber = new Intl.NumberFormat('fa-IR');

function appendUniqueProducts(
  current: PublicCatalogProductSummary[],
  incoming: PublicCatalogProductSummary[],
): PublicCatalogProductSummary[] {
  const existingIds = new Set(current.map(({ id }) => id));

  return [...current, ...incoming.filter(({ id }) => !existingIds.has(id))];
}

function measureCatalogProducts(
  name: 'view_item_list' | 'select_item',
  list: CatalogList,
  products: readonly PublicCatalogProductSummary[],
) {
  void trackFunnelEvent(
    { name, list, items: products.map((product) => ({ productId: product.slug })) },
    {
      publish: () =>
        trackCatalogEvent(
          name,
          list,
          products.map((product) => ({
            itemId: product.slug,
            itemName: product.name,
            priceToman: product.salePriceToman,
          })),
        ),
    },
  );
}

export function CatalogProductGrid({
  filters,
  initialProducts,
  initialFallbackSources = {},
  imageSizes,
  className,
  paginationPath = '/products',
  prioritizeFirstImage = false,
  facetScope,
  paused = false,
  campaignRequest,
  autoLoad = true,
}: CatalogProductGridProps) {
  const [products, setProducts] = useState<PublicCatalogProductSummary[]>(initialProducts.items);
  const [nextPage, setNextPage] = useState(initialProducts.page + 1);
  const [totalPages, setTotalPages] = useState(initialProducts.totalPages);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const activeRequest = useRef<AbortController | null>(null);
  const nextPageRef = useRef(initialProducts.page + 1);
  const totalPagesRef = useRef(initialProducts.totalPages);
  const measuredProducts = useRef(new Set<string>());
  const list: CatalogList = paginationPath.startsWith('/categories/')
    ? 'category'
    : paginationPath.startsWith('/brands/')
      ? 'brand'
      : filters.q
        ? 'search'
        : 'catalog';
  const hasMore = nextPage <= totalPages;
  const noFollowPagination =
    facetScope && (filters.sort !== 'newest' || hasCatalogFacetFilters(filters));
  const campaignKey = campaignRequest
    ? `${campaignRequest.pathname}?${campaignRequest.query}:${initialProducts.page}`
    : null;
  const campaignHref = campaignRequest ? new URLSearchParams(campaignRequest.query) : null;
  campaignHref?.set('page', String(nextPage));
  const nextPageHref = campaignHref
    ? `${paginationPath}?${campaignHref}`
    : facetScope
      ? buildFacetedCatalogHref(paginationPath, { ...filters, page: nextPage })
      : paginationPath === '/products'
        ? buildCatalogHref(filters, { page: nextPage })
        : buildCatalogCollectionHref(paginationPath, filters, { page: nextPage });

  useEffect(() => {
    const position = campaignPosition;
    if (!campaignKey || position?.key !== campaignKey) return;
    let scrollFrame: number | undefined;
    const frame = window.requestAnimationFrame(() => {
      campaignPosition = null;
      setProducts(position.products);
      nextPageRef.current = position.nextPage;
      totalPagesRef.current = position.totalPages;
      setNextPage(position.nextPage);
      setTotalPages(position.totalPages);
      scrollFrame = window.requestAnimationFrame(() => window.scrollTo(0, position.scrollY));
    });
    return () => {
      window.cancelAnimationFrame(frame);
      if (scrollFrame !== undefined) window.cancelAnimationFrame(scrollFrame);
    };
  }, [campaignKey]);

  useEffect(
    () => () => {
      const controller = activeRequest.current;
      activeRequest.current = null;
      controller?.abort();
    },
    [],
  );

  useEffect(() => {
    if (paused) activeRequest.current?.abort();
  }, [paused]);

  const loadNextPage = useCallback(async () => {
    const pageToLoad = nextPageRef.current;

    if (paused || activeRequest.current || pageToLoad > totalPagesRef.current) return;

    const controller = new AbortController();
    activeRequest.current = controller;
    setLoading(true);
    setError(null);

    try {
      let href = buildProductsRequestHref(filters, pageToLoad);
      if (campaignRequest) {
        const query = new URLSearchParams(campaignRequest.query);
        query.set('page', String(pageToLoad));
        href = `${campaignRequest.pathname}?${query}`;
      } else if (facetScope) {
        const query = catalogFacetSearchParams({ ...filters, page: pageToLoad });
        if (facetScope.category) query.set('scopeCategory', facetScope.category);
        if (facetScope.brand) query.set('scopeBrand', facetScope.brand);
        href = `/api/catalog/facets?${query.toString()}`;
      }
      const response = await fetch(href, {
        cache: 'no-store',
        signal: controller.signal,
      });

      if (!response.ok) throw new Error('Catalog request failed.');

      const payload: unknown = await response.json();
      if (controller.signal.aborted) return;

      if (!isProductPage(payload) || payload.page !== pageToLoad) {
        throw new Error('Catalog response is invalid.');
      }

      const followingPage = payload.page + 1;
      setProducts((current) => appendUniqueProducts(current, payload.items));
      nextPageRef.current = followingPage;
      totalPagesRef.current = payload.totalPages;
      setNextPage(followingPage);
      setTotalPages(payload.totalPages);
    } catch {
      if (!controller.signal.aborted)
        setError('بارگذاری محصولات بیشتر انجام نشد. دوباره تلاش کنید.');
    } finally {
      if (activeRequest.current === controller) {
        activeRequest.current = null;
        setLoading(false);
      }
    }
  }, [campaignRequest, facetScope, filters, paused]);

  useEffect(() => {
    const freshProducts = products.filter((product) => !measuredProducts.current.has(product.id));
    for (const product of freshProducts) measuredProducts.current.add(product.id);
    if (freshProducts.length > 0) measureCatalogProducts('view_item_list', list, freshProducts);
  }, [list, products]);

  useEffect(() => {
    const sentinel = sentinelRef.current;

    if (!autoLoad || !sentinel || !hasMore || error || typeof IntersectionObserver === 'undefined')
      return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) void loadNextPage();
      },
      { rootMargin: '500px 0px' },
    );

    observer.observe(sentinel);

    return () => observer.disconnect();
  }, [autoLoad, error, hasMore, loadNextPage]);

  return (
    <>
      <ul className={cn('grid grid-cols-2 gap-x-3 gap-y-10 sm:gap-x-5', className)}>
        {products.map((product, index) => (
          <CatalogProductCard
            key={product.id}
            product={product}
            fallbackSrc={initialFallbackSources[product.id]}
            imageSizes={imageSizes}
            preloadImage={prioritizeFirstImage && index === 0}
            onSelect={() => {
              if (campaignKey) {
                campaignPosition = {
                  key: campaignKey,
                  products,
                  nextPage: nextPageRef.current,
                  totalPages: totalPagesRef.current,
                  scrollY: window.scrollY,
                };
              }
              measureCatalogProducts('select_item', list, [product]);
            }}
          />
        ))}
      </ul>

      {hasMore || loading || error ? (
        <div
          ref={sentinelRef}
          className="mt-10 flex min-h-12 items-center justify-center border-t border-[var(--sf-color-border)] pt-6"
          aria-live="polite"
        >
          {loading ? (
            <span className="flex items-center gap-2 text-sm text-[var(--sf-color-muted)]">
              <span
                aria-hidden="true"
                className="size-4 animate-spin rounded-full border border-current border-t-transparent"
              />
              در حال بارگذاری محصولات بیشتر…
            </span>
          ) : error ? (
            <div className="text-center">
              <p role="alert" className="text-sm text-red-600">
                {error}
              </p>
              <Button className="mt-3" variant="outline" size="sm" onClick={loadNextPage}>
                تلاش مجدد
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <Button variant="text" size="sm" onClick={loadNextPage}>
                نمایش محصولات بیشتر
              </Button>
              <a
                href={nextPageHref}
                rel={
                  noFollowPagination || (campaignRequest && campaignRequest.query)
                    ? 'nofollow'
                    : undefined
                }
                className="text-xs text-[var(--sf-color-muted)] underline underline-offset-4"
              >
                رفتن به صفحه {persianNumber.format(nextPage)}
              </a>
            </div>
          )}
        </div>
      ) : null}
    </>
  );
}
