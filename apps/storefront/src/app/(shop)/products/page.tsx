import Link from 'next/link';
import type { Metadata } from 'next';

import { CatalogFilterForm } from '@/components/catalog/catalog-filter-form';
import { CatalogHero } from '@/components/catalog/catalog-hero';
import { CatalogFilterSheet } from '@/components/catalog/catalog-filter-sheet';
import { CatalogProductGrid } from '@/components/catalog/catalog-product-grid';
import { StorefrontBreadcrumbs } from '@/components/seo/storefront-breadcrumbs';
import { Button, ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Select } from '@/components/ui/select';
import {
  getCatalogDevHeroImageSrc,
  getCatalogDevProductImageSources,
} from '@/lib/catalog/dev-media.server';
import {
  buildCatalogHref,
  getPublicCatalogIndex,
  parseCatalogSearchParams,
  type CatalogSearchParams,
} from '@/lib/catalog/public-catalog';
import { buildStorefrontPageMetadata } from '@/lib/seo/metadata';
import { getPublicSiteSettings } from '@/lib/site-settings/public-site-settings';

type ProductsPageProps = Readonly<{
  searchParams: Promise<CatalogSearchParams>;
}>;

const persianNumber = new Intl.NumberFormat('fa-IR');

export async function generateMetadata({ searchParams }: ProductsPageProps): Promise<Metadata> {
  const rawSearchParams = await searchParams;
  const filters = parseCatalogSearchParams(rawSearchParams);
  const settings = await getPublicSiteSettings();

  return buildStorefrontPageMetadata(settings, {
    pathname: '/products',
    searchParams: rawSearchParams,
    title: filters.q ? `نتایج جستجوی «${filters.q}»` : 'محصولات نقره',
    description: settings.catalogHeroSubtitle ?? 'مجموعه محصولات نقره گالری حمیدیان را مرور کنید.',
    fallbackMedia: settings.catalogHeroMedia,
  });
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const filters = parseCatalogSearchParams(await searchParams);
  const [{ products, categories, brands }, siteSettings] = await Promise.all([
    getPublicCatalogIndex(filters),
    getPublicSiteSettings(),
  ]);
  const heroImageSrc = getCatalogDevHeroImageSrc();
  const activeFilterCount = [filters.q, filters.category, filters.brand, filters.country].filter(
    Boolean,
  ).length;
  const hasActiveFilters = Boolean(activeFilterCount > 0 || filters.sort !== 'newest');

  return (
    <main id="main-content" className="pb-[var(--sf-section-space)]">
      <CatalogHero settings={siteSettings} devFallbackSrc={heroImageSrc} />

      <section className="sf-container pt-8">
        <StorefrontBreadcrumbs
          items={[
            { label: 'خانه', href: '/' },
            { label: 'محصولات', href: '/products' },
          ]}
          className="mb-6 text-[var(--sf-color-muted)]"
        />
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
              {filters.country ? (
                <input type="hidden" name="country" value={filters.country} />
              ) : null}
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
                <CatalogProductGrid
                  key={buildCatalogHref(filters)}
                  filters={filters}
                  initialProducts={products}
                  initialFallbackSources={getCatalogDevProductImageSources(products.items)}
                  imageSizes="(min-width: 1536px) 20vw, (min-width: 1280px) 27vw, (min-width: 1024px) 40vw, 50vw"
                  className="xl:grid-cols-3 2xl:grid-cols-4"
                />
                {products.page < products.totalPages ? (
                  <noscript>
                    <div className="mt-10 border-t border-[var(--sf-color-border)] pt-6 text-center text-sm">
                      <Link href={buildCatalogHref(filters, { page: products.page + 1 })}>
                        مشاهده محصولات بیشتر
                      </Link>
                    </div>
                  </noscript>
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
