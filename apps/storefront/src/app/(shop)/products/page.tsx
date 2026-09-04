import Link from 'next/link';

import { CatalogFilterForm } from '@/components/catalog/catalog-filter-form';
import { CatalogHero } from '@/components/catalog/catalog-hero';
import { CatalogFilterSheet } from '@/components/catalog/catalog-filter-sheet';
import { CatalogProductCard } from '@/components/catalog/catalog-product-card';
import { Button, ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Select } from '@/components/ui/select';
import { getCatalogDevHeroImageSrc } from '@/lib/catalog/dev-media.server';
import {
  buildCatalogHref,
  getPublicCatalogIndex,
  parseCatalogSearchParams,
  type CatalogSearchParams,
} from '@/lib/catalog/public-catalog';
import { getPublicSiteSettings } from '@/lib/site-settings/public-site-settings';

type ProductsPageProps = Readonly<{
  searchParams: Promise<CatalogSearchParams>;
}>;

const persianNumber = new Intl.NumberFormat('fa-IR');

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const filters = parseCatalogSearchParams(await searchParams);
  const [{ products, categories, brands }, siteSettings] = await Promise.all([
    getPublicCatalogIndex(filters),
    getPublicSiteSettings(),
  ]);
  const heroImageSrc = getCatalogDevHeroImageSrc();
  const activeFilterCount = [filters.q, filters.category, filters.brand].filter(Boolean).length;
  const hasActiveFilters = Boolean(activeFilterCount > 0 || filters.sort !== 'newest');

  return (
    <main id="main-content" className="pb-[var(--sf-section-space)]">
      <CatalogHero settings={siteSettings} devFallbackSrc={heroImageSrc} />

      <section className="sf-container pt-8">
        <div
          className="
            flex flex-wrap items-center justify-between gap-4
            border-b border-[var(--sf-color-border)] pb-6
          "
        >
          <div>
            <p className="text-lg font-medium">{persianNumber.format(products.total)} محصول</p>
            {hasActiveFilters ? (
              <Link
                href="/products"
                className="mt-1 inline-block text-xs text-[var(--sf-color-muted)] underline underline-offset-4"
              >
                پاک کردن فیلترها
              </Link>
            ) : null}
          </div>

          <div className="flex items-end gap-3">
            <div className="lg:hidden">
              <CatalogFilterSheet activeCount={activeFilterCount}>
                <CatalogFilterForm
                  filters={filters}
                  categories={categories}
                  brands={brands}
                  idPrefix="mobile-catalog-filter"
                  className="pt-2"
                />
              </CatalogFilterSheet>
            </div>

            <form
              action="/products"
              method="get"
              className="flex min-w-[11rem] items-end gap-2 sm:min-w-[15rem]"
            >
              {filters.q ? <input type="hidden" name="q" value={filters.q} /> : null}
              {filters.category ? (
                <input type="hidden" name="category" value={filters.category} />
              ) : null}
              {filters.brand ? <input type="hidden" name="brand" value={filters.brand} /> : null}
              <div className="min-w-0 flex-1">
                <label htmlFor="catalog-sort" className="sr-only">
                  مرتب‌سازی
                </label>
                <Select
                  id="catalog-sort"
                  name="sort"
                  defaultValue={filters.sort}
                  aria-label="مرتب‌سازی محصولات"
                  options={[
                    { value: 'newest', label: 'جدیدترین‌ها' },
                    { value: 'price-asc', label: 'کمترین قیمت' },
                    { value: 'price-desc', label: 'بیشترین قیمت' },
                    { value: 'name-asc', label: 'نام محصول' },
                  ]}
                />
              </div>
              <Button type="submit" variant="outline" size="md">
                اعمال
              </Button>
            </form>
          </div>
        </div>

        <div className="grid gap-8 pt-8 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-10">
          <aside className="hidden lg:block">
            <div className="sticky top-6">
              <div className="mb-5 flex items-center justify-between gap-3">
                <h2 className="text-base font-medium">فیلترها</h2>
                {activeFilterCount > 0 ? (
                  <span className="text-xs text-[var(--sf-color-muted)]">
                    {persianNumber.format(activeFilterCount)} فعال
                  </span>
                ) : null}
              </div>
              <CatalogFilterForm
                filters={filters}
                categories={categories}
                brands={brands}
                idPrefix="desktop-catalog-filter"
              />
            </div>
          </aside>

          <div className="min-w-0">
            {products.items.length > 0 ? (
              <>
                <ul
                  className="
                    grid grid-cols-2 gap-x-3 gap-y-10
                    sm:gap-x-5 xl:grid-cols-3 2xl:grid-cols-4
                  "
                >
                  {products.items.map((product) => (
                    <CatalogProductCard key={product.id} product={product} />
                  ))}
                </ul>

                {products.totalPages > 1 ? (
                  <nav
                    aria-label="صفحه‌بندی محصولات"
                    className="
                      mt-10 flex items-center justify-between gap-4
                      border-t border-[var(--sf-color-border)] pt-6 text-sm
                    "
                  >
                    {products.page > 1 ? (
                      <Link href={buildCatalogHref(filters, { page: products.page - 1 })}>
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
                      <Link href={buildCatalogHref(filters, { page: products.page + 1 })}>
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
                title="محصولی پیدا نشد"
                description="عبارت جستجو یا فیلترها را تغییر دهید."
                action={
                  <ButtonLink href="/products" variant="text" size="sm">
                    مشاهده همه محصولات
                  </ButtonLink>
                }
              />
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
