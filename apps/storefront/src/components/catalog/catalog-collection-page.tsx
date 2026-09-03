import Link from 'next/link';

import { CatalogMedia } from '@/components/catalog/catalog-media';
import { CatalogProductCard } from '@/components/catalog/catalog-product-card';
import { Button, ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Select } from '@/components/ui/form-control';
import { FormField } from '@/components/ui/form-field';
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
          <div className="aspect-[4/3] overflow-hidden bg-[var(--sf-color-surface)]">
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
        <FormField id={`collection-sort-${path}`} label="مرتب‌سازی" className="min-w-48">
          {(controlProps) => (
            <Select {...controlProps} name="sort" defaultValue={filters.sort}>
              <option value="newest">جدیدترین‌ها</option>
              <option value="price-asc">کمترین قیمت</option>
              <option value="price-desc">بیشترین قیمت</option>
              <option value="name-asc">نام محصول</option>
            </Select>
          )}
        </FormField>

        <Button type="submit">اعمال</Button>
      </form>

      {products.items.length > 0 ? (
        <>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-10 py-10 md:grid-cols-3 lg:grid-cols-4">
            {products.items.map((product) => (
              <CatalogProductCard key={product.id} product={product} />
            ))}
          </ul>

          {products.totalPages > 1 ? (
            <nav
              aria-label={`صفحه‌بندی محصولات ${title}`}
              className="
                flex items-center justify-between gap-4
                border-t border-[var(--sf-color-border)] pt-6 text-sm
              "
            >
              {products.page > 1 ? (
                <Link
                  href={buildCatalogCollectionHref(path, filters, {
                    page: products.page - 1,
                  })}
                >
                  صفحه قبل
                </Link>
              ) : (
                <span />
              )}

              <span className="text-[var(--sf-color-muted)]">
                صفحه {persianNumber.format(products.page)} از{' '}
                {persianNumber.format(products.totalPages)}
              </span>

              {products.page < products.totalPages ? (
                <Link
                  href={buildCatalogCollectionHref(path, filters, {
                    page: products.page + 1,
                  })}
                >
                  صفحه بعد
                </Link>
              ) : (
                <span />
              )}
            </nav>
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
