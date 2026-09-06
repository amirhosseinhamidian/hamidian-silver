import Link from 'next/link';

import { CatalogMedia } from '@/components/catalog/catalog-media';
import { CatalogProductGrid } from '@/components/catalog/catalog-product-grid';
import { Button, ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { FormField } from '@/components/ui/form-field';
import { Select } from '@/components/ui/select';
import { getCatalogDevProductImageSources } from '@/lib/catalog/dev-media.server';
import {
  buildCatalogCollectionHref,
  type CatalogFilters,
  type PublicCatalogMedia,
  type PublicCatalogProductList,
} from '@/lib/catalog/public-catalog';

type CatalogCollectionPageProps = Readonly<{
  path: string;
  eyebrow: string;
  title: string;
  description: string | null;
  image: PublicCatalogMedia | null;
  filters: CatalogFilters;
  products: PublicCatalogProductList;
}>;

const persianNumber = new Intl.NumberFormat('fa-IR');

const sortOptions = [
  { value: 'newest', label: 'جدیدترین‌ها' },
  { value: 'price-asc', label: 'کمترین قیمت' },
  { value: 'price-desc', label: 'بیشترین قیمت' },
  { value: 'name-asc', label: 'نام محصول' },
] as const;

export function CatalogCollectionPage({
  path,
  eyebrow,
  title,
  description,
  image,
  filters,
  products,
}: CatalogCollectionPageProps) {
  return (
    <main id="main-content" className="sf-container py-[var(--sf-section-space)]">
      <header
        className={`
          grid gap-8 border-b border-[var(--sf-color-border)] pb-10
          ${image ? 'md:grid-cols-[minmax(0,1fr)_minmax(18rem,0.55fr)] md:items-center' : ''}
        `}
      >
        <div>
          <Link
            href="/products"
            className="text-xs text-[var(--sf-color-muted)] transition-opacity hover:opacity-60"
          >
            محصولات
          </Link>
          <p className="mt-6 text-sm text-[var(--sf-color-muted)]">{eyebrow}</p>
          <h1 className="mt-3 text-4xl font-normal sm:text-5xl">{title}</h1>
          {description ? (
            <p className="mt-5 max-w-2xl text-sm leading-8 text-[var(--sf-color-muted)]">
              {description}
            </p>
          ) : null}
          <p className="mt-5 text-sm text-[var(--sf-color-subtle)]">
            {persianNumber.format(products.total)} محصول
          </p>
        </div>

        {image ? (
          <div
            className="
              aspect-[4/3] overflow-hidden rounded-[var(--sf-radius-md)]
              bg-[var(--sf-color-surface)]
            "
          >
            <CatalogMedia media={image} alt={title} eager />
          </div>
        ) : null}
      </header>

      <form
        action={path}
        method="get"
        className="
          flex flex-wrap items-end justify-between gap-4
          border-b border-[var(--sf-color-border)] py-6
        "
      >
        <FormField id={`collection-sort-${path}`} label="مرتب‌سازی" className="min-w-52">
          {(controlProps) => (
            <Select
              {...controlProps}
              name="sort"
              defaultValue={filters.sort}
              options={sortOptions}
            />
          )}
        </FormField>

        <Button type="submit">اعمال</Button>
      </form>

      {products.items.length > 0 ? (
        <>
          <CatalogProductGrid
            key={`${path}:${filters.sort}:${filters.page}`}
            filters={filters}
            initialProducts={products}
            initialFallbackSources={getCatalogDevProductImageSources(products.items)}
            className="py-10 md:grid-cols-3 lg:grid-cols-4"
          />
          {products.page < products.totalPages ? (
            <noscript>
              <div className="border-t border-[var(--sf-color-border)] pt-6 text-center text-sm">
                <Link
                  href={buildCatalogCollectionHref(path, filters, {
                    page: products.page + 1,
                  })}
                >
                  مشاهده محصولات بیشتر
                </Link>
              </div>
            </noscript>
          ) : null}
        </>
      ) : (
        <EmptyState
          title="هنوز محصولی در این مجموعه نیست"
          description="می‌توانید سایر محصولات گالری را مشاهده کنید."
          action={
            <ButtonLink href="/products" variant="text" size="sm">
              مشاهده همه محصولات
            </ButtonLink>
          }
        />
      )}
    </main>
  );
}
