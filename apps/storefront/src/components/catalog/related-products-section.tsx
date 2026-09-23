'use client';

import { useState } from 'react';

import { CatalogProductCard } from '@/components/catalog/catalog-product-card';
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
      setItems((current) => [...current, ...result.items]);
      setPage(result.page);
      setTotalPages(result.totalPages);
    } finally {
      setLoading(false);
    }
  }

  if (items.length === 0) return null;

  return (
    <section aria-labelledby="related-products-title" className="mt-16 sm:mt-20">
      <h2 id="related-products-title" className="text-2xl font-medium sm:text-3xl">
        محصولات مشابه
      </h2>
      <ul className="mt-7 grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 lg:grid-cols-4">
        {items.map((product) => (
          <CatalogProductCard key={product.id} product={product} />
        ))}
      </ul>
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
    </section>
  );
}
