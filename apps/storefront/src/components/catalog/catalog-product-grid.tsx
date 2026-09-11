'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { CatalogProductCard } from '@/components/catalog/catalog-product-card';
import { Button } from '@/components/ui/button';
import type {
  CatalogFilters,
  PublicCatalogProductList,
  PublicCatalogProductSummary,
} from '@/lib/catalog/public-catalog';
import { cn } from '@/lib/ui/cn';

type CatalogProductGridProps = Readonly<{
  filters: CatalogFilters;
  initialProducts: PublicCatalogProductList;
  initialFallbackSources?: Readonly<Record<string, string>>;
  imageSizes?: string;
  className?: string;
}>;

function buildProductsRequestHref(filters: CatalogFilters, page: number): string {
  const searchParams = new URLSearchParams({ page: String(page) });

  if (filters.q) searchParams.set('q', filters.q);
  if (filters.category) searchParams.set('category', filters.category);
  if (filters.brand) searchParams.set('brand', filters.brand);
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

function appendUniqueProducts(
  current: PublicCatalogProductSummary[],
  incoming: PublicCatalogProductSummary[],
): PublicCatalogProductSummary[] {
  const existingIds = new Set(current.map(({ id }) => id));

  return [...current, ...incoming.filter(({ id }) => !existingIds.has(id))];
}

export function CatalogProductGrid({
  filters,
  initialProducts,
  initialFallbackSources = {},
  imageSizes,
  className,
}: CatalogProductGridProps) {
  const [products, setProducts] = useState<PublicCatalogProductSummary[]>(initialProducts.items);
  const [nextPage, setNextPage] = useState(initialProducts.page + 1);
  const [totalPages, setTotalPages] = useState(initialProducts.totalPages);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);
  const nextPageRef = useRef(initialProducts.page + 1);
  const totalPagesRef = useRef(initialProducts.totalPages);
  const hasMore = nextPage <= totalPages;

  const loadNextPage = useCallback(async () => {
    const pageToLoad = nextPageRef.current;

    if (loadingRef.current || pageToLoad > totalPagesRef.current) return;

    loadingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(buildProductsRequestHref(filters, pageToLoad), {
        cache: 'no-store',
      });

      if (!response.ok) throw new Error('Catalog request failed.');

      const payload: unknown = await response.json();

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
      setError('بارگذاری محصولات بیشتر انجام نشد. دوباره تلاش کنید.');
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    const sentinel = sentinelRef.current;

    if (!sentinel || !hasMore || error || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) void loadNextPage();
      },
      { rootMargin: '500px 0px' },
    );

    observer.observe(sentinel);

    return () => observer.disconnect();
  }, [error, hasMore, loadNextPage]);

  return (
    <>
      <ul className={cn('grid grid-cols-2 gap-x-3 gap-y-10 sm:gap-x-5', className)}>
        {products.map((product) => (
          <CatalogProductCard
            key={product.id}
            product={product}
            fallbackSrc={initialFallbackSources[product.id]}
            imageSizes={imageSizes}
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
            <Button variant="text" size="sm" onClick={loadNextPage}>
              نمایش محصولات بیشتر
            </Button>
          )}
        </div>
      ) : null}
    </>
  );
}
