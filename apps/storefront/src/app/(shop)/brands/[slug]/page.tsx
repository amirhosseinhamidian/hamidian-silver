import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { CatalogCollectionPage } from '@/components/catalog/catalog-collection-page';
import {
  getPublicCatalogBrands,
  getPublicCatalogProducts,
  parseCatalogSearchParams,
  type CatalogFilters,
  type CatalogSearchParams,
} from '@/lib/catalog/public-catalog';
import { buildStorefrontPageMetadata } from '@/lib/seo/metadata';
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
  const brand = brands.find((candidate) => candidate.slug === slug);

  if (!brand) {
    return {
      title: 'برند یافت نشد',
      robots: { index: false, follow: false },
    };
  }

  return buildStorefrontPageMetadata(settings, {
    pathname: `/brands/${brand.slug}`,
    searchParams: rawSearchParams,
    title: brand.name,
    description: brand.description,
    seoTitle: brand.seoTitle,
    seoDescription: brand.seoDescription,
    seoCanonicalPath: brand.seoCanonicalPath,
    seoNoIndex: brand.seoNoIndex,
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
    notFound();
  }

  return (
    <CatalogCollectionPage
      path={`/brands/${brand.slug}`}
      eyebrow="برند"
      title={brand.name}
      description={brand.description}
      image={brand.heroImage ?? null}
      filters={filters}
      products={products}
    />
  );
}
