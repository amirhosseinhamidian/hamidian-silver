'use client';

import { useState } from 'react';

import { RecommendationCards } from '@/components/catalog/product-recommendations';
import { Button } from '@/components/ui/button';
import type { PublicCatalogProductList } from '@/lib/catalog/public-catalog';

type RelatedProductsSectionProps = Readonly<{
  productSlug: string;
  initial: PublicCatalogProductList;
}>;

export function RelatedProductsSection({ productSlug, initial }: RelatedProductsSectionProps) {
  const [items, setItems] = useState(initial.items);
  const [page, setPage] = useState(initial.page);
  const [totalPages, setTotalPages] = useState(initial.totalPages);
  const [loading, setLoading] = useState(false);

  async function loadMore() {
    setLoading(true);
    try {
      const nextPage = page + 1;
      const response = await fetch(
        `/api/catalog/products/${encodeURIComponent(productSlug)}/related?page=${nextPage}&pageSize=${initial.pageSize}`,
      );
      if (!response.ok) return;
      const result = (await response.json()) as PublicCatalogProductList;
      setItems((current) => {
        const known = new Set(current.map(({ id }) => id));
        return [...current, ...result.items.filter(({ id }) => !known.has(id))];
      });
      setPage(result.page);
      setTotalPages(result.totalPages);
    } catch {
      // Keep the visible products and allow retrying the same page.
    } finally {
      setLoading(false);
    }
  }

  if (items.length === 0) return null;

  return (
    <RecommendationCards list="product_recommendations" items={items}>
      {page < totalPages ? (
        <div className="mt-10 flex justify-center">
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={() => void loadMore()}
          >
            {loading ? 'در حال دریافت…' : 'مشاهده بیشتر'}
          </Button>
        </div>
      ) : null}
    </RecommendationCards>
  );
}
