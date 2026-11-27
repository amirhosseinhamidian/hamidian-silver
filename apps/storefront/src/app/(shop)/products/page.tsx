import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { CatalogFacetedListing } from '@/components/catalog/catalog-faceted-listing';
import { CatalogHero } from '@/components/catalog/catalog-hero';
import { StorefrontBreadcrumbs } from '@/components/seo/storefront-breadcrumbs';
import { ButtonLink } from '@/components/ui/button';
import {
  getCatalogDevHeroImageSrc,
  getCatalogDevProductImageSources,
} from '@/lib/catalog/dev-media.server';
import {
  hasCatalogFacetFilters,
  isCatalogPageOutOfRange,
  parseCatalogFacetFilters,
  type CatalogSearchParams,
} from '@/lib/catalog/catalog-filter-state';
import { maxCatalogFacetPage } from '@/lib/catalog/catalog-pagination';
import { getPublicFacetedCatalog } from '@/lib/catalog/public-catalog';
import { ROOT_CATALOG_SEO } from '@/lib/seo/content-copy';
import { buildStorefrontPageMetadata } from '@/lib/seo/metadata';
import { getPublicSiteSettings } from '@/lib/site-settings/public-site-settings';

type ProductsPageProps = Readonly<{
  searchParams: Promise<CatalogSearchParams>;
}>;

export async function generateMetadata({ searchParams }: ProductsPageProps): Promise<Metadata> {
  const rawSearchParams = await searchParams;
  const filters = parseCatalogFacetFilters(rawSearchParams);
  if (filters.page > maxCatalogFacetPage) {
    return { title: 'صفحه محصولات یافت نشد', robots: { index: false, follow: false } };
  }
  const [settings, products] = await Promise.all([
    getPublicSiteSettings(),
    filters.sort === 'newest' && !hasCatalogFacetFilters(filters)
      ? getPublicFacetedCatalog(filters)
      : Promise.resolve(null),
  ]);
  if (products && isCatalogPageOutOfRange(filters, products)) {
    return { title: 'صفحه محصولات یافت نشد', robots: { index: false, follow: false } };
  }
  return buildStorefrontPageMetadata(settings, {
    pathname: '/products',
    searchParams: rawSearchParams,
    title: filters.q ? `نتایج جستجوی «${filters.q}»` : ROOT_CATALOG_SEO.title,
    description: settings.catalogHeroSubtitle ?? ROOT_CATALOG_SEO.description,
    fallbackMedia: settings.catalogHeroMedia,
    seoNoIndex: products?.total === 0,
  });
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const filters = parseCatalogFacetFilters(await searchParams);
  if (filters.page > maxCatalogFacetPage) notFound();
  const [listing, siteSettings] = await Promise.all([
    getPublicFacetedCatalog(filters),
    getPublicSiteSettings(),
  ]);
  if (!hasCatalogFacetFilters(filters) && isCatalogPageOutOfRange(filters, listing)) {
    notFound();
  }
  return (
    <main id="main-content" className="pb-[var(--sf-section-space)]">
      <CatalogHero settings={siteSettings} devFallbackSrc={getCatalogDevHeroImageSrc()} />
      <section className="sf-container pt-8" aria-label="فهرست محصولات">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <StorefrontBreadcrumbs
            items={[
              { label: 'خانه', href: '/' },
              { label: 'محصولات', href: '/products' },
            ]}
            className="text-[var(--sf-color-muted)]"
          />
          <ButtonLink href="/gift-finder" variant="outline" size="sm">
            راهنمای انتخاب هدیه
          </ButtonLink>
        </div>
        <CatalogFacetedListing
          path="/products"
          filtersEnabled={process.env.CATALOG_FACETS_ENABLED !== 'false'}
          filters={filters}
          listing={listing}
          fallbackSources={getCatalogDevProductImageSources(listing.items)}
          prioritizeFirstImage={
            !siteSettings.catalogHeroEnabled || !siteSettings.catalogHeroMedia?.url
          }
        />
      </section>
    </main>
  );
}
