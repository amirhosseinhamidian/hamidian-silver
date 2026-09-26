import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';

import { CatalogCollectionPage } from '@/components/catalog/catalog-collection-page';
import {
  getPublicCatalogBrands,
  getPublicCatalogProducts,
  parseCatalogSearchParams,
  type CatalogFilters,
  type CatalogSearchParams,
} from '@/lib/catalog/public-catalog';
import { brandSeoDescription, brandSeoTitle } from '@/lib/seo/content-copy';
import { buildStorefrontPageMetadata } from '@/lib/seo/metadata';
import { getPublicSeoRedirect } from '@/lib/seo/redirects';
import { getPublicSiteSettings } from '@/lib/site-settings/public-site-settings';

type BrandPageProps = Readonly<{
  params: Promise<{ slug: string }>;
  searchParams: Promise<CatalogSearchParams>;
}>;

export async function generateMetadata({
  params,
  searchParams,
}: BrandPageProps): Promise<Metadata> {
  const [{ slug }, rawSearchParams, brands, settings] = await Promise.all([
    params,
    searchParams,
    getPublicCatalogBrands(),
    getPublicSiteSettings(),
  ]);
  const parsedFilters = parseCatalogSearchParams(rawSearchParams);
  const brand = brands.find((candidate) => candidate.slug === slug);

  if (!brand) {
    return {
      title: 'برند یافت نشد',
      robots: { index: false, follow: false },
    };
  }

  const shouldCheckEmpty = parsedFilters.page === 1 && parsedFilters.sort === 'newest';
  const products = shouldCheckEmpty
    ? await getPublicCatalogProducts({
        page: 1,
        pageSize: parsedFilters.pageSize,
        sort: 'newest',
        brand: brand.slug,
      })
    : null;
  const emptyCollection = Boolean(shouldCheckEmpty && products?.total === 0);

  return buildStorefrontPageMetadata(settings, {
    pathname: `/brands/${brand.slug}`,
    searchParams: rawSearchParams,
    title: brandSeoTitle(brand),
    description: brandSeoDescription(brand),
    seoTitle: brand.seoTitle,
    seoDescription: brand.seoDescription,
    seoCanonicalPath: brand.seoCanonicalPath,
    seoNoIndex: Boolean(brand.seoNoIndex || emptyCollection),
    seoOgMedia: brand.seoOgMedia,
    fallbackMedia: brand.heroImage ?? brand.image,
  });
}

export default async function BrandPage({ params, searchParams }: BrandPageProps) {
  const [{ slug }, parsedFilters] = await Promise.all([
    params,
    searchParams.then(parseCatalogSearchParams),
  ]);
  const filters: CatalogFilters = {
    page: parsedFilters.page,
    pageSize: parsedFilters.pageSize,
    sort: parsedFilters.sort,
    brand: slug,
  };

  const [brands, products] = await Promise.all([
    getPublicCatalogBrands(),
    getPublicCatalogProducts(filters),
  ]);
  const brand = brands.find((candidate) => candidate.slug === slug);

  if (!brand) {
    const destinationPath = await getPublicSeoRedirect(`/brands/${slug}`);
    if (destinationPath) permanentRedirect(destinationPath);
    notFound();
  }

  if (filters.sort === 'newest' && filters.page > 1 && filters.page > products.totalPages) {
    notFound();
  }

  return (
    <CatalogCollectionPage
      path={`/brands/${brand.slug}`}
      eyebrow="برند"
      title={brand.name}
      description={brandSeoDescription(brand)}
      image={brand.heroImage ?? null}
      mobileImage={brand.heroMobileImage ?? null}
      filters={filters}
      products={products}
      contextLinkGroups={[
        {
          label: 'دسته‌بندی‌های این برند',
          links: [
            ...new Map(
              products.items
                .flatMap((product) => product.categories)
                .map(
                  (category) =>
                    [
                      category.id,
                      {
                        label: category.name,
                        href: `/categories/${category.slug}`,
                      },
                    ] as const,
                ),
            ).values(),
          ].slice(0, 8),
        },
      ]}
    />
  );
}
