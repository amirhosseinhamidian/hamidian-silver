import Link from 'next/link';

import { CatalogProductCard } from '@/components/catalog/catalog-product-card';
import { Button, ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input, Select } from '@/components/ui/form-control';
import { FormField } from '@/components/ui/form-field';
import {
  buildCatalogHref,
  getPublicCatalogIndex,
  parseCatalogSearchParams,
  type CatalogSearchParams,
} from '@/lib/catalog/public-catalog';

type ProductsPageProps = Readonly<{
  searchParams: Promise<CatalogSearchParams>;
}>;

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const filters = parseCatalogSearchParams(await searchParams);
  const { products, categories, brands } = await getPublicCatalogIndex(filters);
  const hasActiveFilters = Boolean(
    filters.q || filters.category || filters.brand || filters.sort !== 'newest',
  );

  return (
    <main id="main-content" className="sf-container py-[var(--sf-section-space)]">
      <header className="flex flex-col gap-5 border-b border-[var(--sf-color-border)] pb-8">
        <p className="text-sm text-[var(--sf-color-muted)]">کاتالوگ فروشگاه</p>
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <h1 className="text-4xl font-normal sm:text-5xl">محصولات نقره حمیدیان</h1>
            <p className="mt-3 text-sm text-[var(--sf-color-muted)]">
              {new Intl.NumberFormat('fa-IR').format(products.total)} محصول
            </p>
          </div>

          {hasActiveFilters ? (
            <Link
              href="/products"
              className="text-sm underline decoration-[var(--sf-color-border-strong)] underline-offset-4"
            >
              پاک کردن فیلترها
            </Link>
          ) : null}
        </div>
      </header>

      <form
        action="/products"
        method="get"
        className="
          grid gap-4 border-b border-[var(--sf-color-border)] py-6
          sm:grid-cols-2 lg:grid-cols-[minmax(14rem,1fr)_repeat(3,minmax(10rem,0.55fr))_auto]
        "
      >
        <FormField id="catalog-search" label="جستجو">
          {(controlProps) => (
            <Input
              {...controlProps}
              type="search"
              name="q"
              defaultValue={filters.q ?? ''}
              maxLength={100}
              placeholder="نام محصول..."
            />
          )}
        </FormField>

        <FormField id="catalog-category" label="دسته‌بندی">
          {(controlProps) => (
            <Select {...controlProps} name="category" defaultValue={filters.category ?? ''}>
              <option value="">همه دسته‌ها</option>
              {categories.map((category) => (
                <option key={category.id} value={category.slug}>
                  {category.name}
                </option>
              ))}
            </Select>
          )}
        </FormField>

        <FormField id="catalog-brand" label="برند">
          {(controlProps) => (
            <Select {...controlProps} name="brand" defaultValue={filters.brand ?? ''}>
              <option value="">همه برندها</option>
              {brands.map((brand) => (
                <option key={brand.id} value={brand.slug}>
                  {brand.name}
                </option>
              ))}
            </Select>
          )}
        </FormField>

        <FormField id="catalog-sort" label="مرتب‌سازی">
          {(controlProps) => (
            <Select {...controlProps} name="sort" defaultValue={filters.sort}>
              <option value="newest">جدیدترین‌ها</option>
              <option value="price-asc">کمترین قیمت</option>
              <option value="price-desc">بیشترین قیمت</option>
              <option value="name-asc">نام محصول</option>
            </Select>
          )}
        </FormField>

        <Button type="submit" className="self-end">
          اعمال
        </Button>
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
              aria-label="صفحه‌بندی محصولات"
              className="
                flex items-center justify-between gap-4
                border-t border-[var(--sf-color-border)] pt-6 text-sm
              "
            >
              {products.page > 1 ? (
                <Link href={buildCatalogHref(filters, { page: products.page - 1 })}>صفحه قبل</Link>
              ) : (
                <span />
              )}

              <span className="text-[var(--sf-color-muted)]">
                صفحه {new Intl.NumberFormat('fa-IR').format(products.page)} از{' '}
                {new Intl.NumberFormat('fa-IR').format(products.totalPages)}
              </span>

              {products.page < products.totalPages ? (
                <Link href={buildCatalogHref(filters, { page: products.page + 1 })}>صفحه بعد</Link>
              ) : (
                <span />
              )}
            </nav>
          ) : null}
        </>
      ) : (
        <EmptyState
          title="محصولی پیدا نشد"
          description="عبارت جستجو یا فیلترها را تغییر دهید."
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
