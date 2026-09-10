import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';

import { CatalogCollectionPage } from '@/components/catalog/catalog-collection-page';
import {
  getPublicCatalogCategories,
  getPublicCatalogProducts,
  parseCatalogSearchParams,
  type CatalogFilters,
  type CatalogSearchParams,
} from '@/lib/catalog/public-catalog';
import { buildStorefrontPageMetadata } from '@/lib/seo/metadata';
import { getPublicSeoRedirect } from '@/lib/seo/redirects';
import { getPublicSiteSettings } from '@/lib/site-settings/public-site-settings';

type CategoryPageProps = Readonly<{
  params: Promise<{ slug: string }>;
  searchParams: Promise<CatalogSearchParams>;
}>;

export async function generateMetadata({
  params,
  searchParams,
}: CategoryPageProps): Promise<Metadata> {
  const [{ slug }, rawSearchParams, categories, settings] = await Promise.all([
    params,
    searchParams,
    getPublicCatalogCategories(),
    getPublicSiteSettings(),
  ]);
  const category = categories.find((candidate) => candidate.slug === slug);

  if (!category) {
    return {
      title: 'دسته‌بندی یافت نشد',
      robots: { index: false, follow: false },
    };
  }

  return buildStorefrontPageMetadata(settings, {
    pathname: `/categories/${category.slug}`,
    searchParams: rawSearchParams,
    title: category.name,
    description: category.description,
    seoTitle: category.seoTitle,
    seoDescription: category.seoDescription,
    seoCanonicalPath: category.seoCanonicalPath,
    seoNoIndex: category.seoNoIndex,
    seoOgMedia: category.seoOgMedia,
    fallbackMedia: category.image,
  });
}

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const [{ slug }, parsedFilters] = await Promise.all([
    params,
    searchParams.then(parseCatalogSearchParams),
  ]);
  const filters: CatalogFilters = {
    page: parsedFilters.page,
    pageSize: parsedFilters.pageSize,
    sort: parsedFilters.sort,
    category: slug,
  };

  const [categories, products] = await Promise.all([
    getPublicCatalogCategories(),
    getPublicCatalogProducts(filters),
  ]);
  const category = categories.find((candidate) => candidate.slug === slug);

  if (!category) {
    const destinationPath = await getPublicSeoRedirect(`/categories/${slug}`);
    if (destinationPath) permanentRedirect(destinationPath);
    notFound();
  }

  return (
    <CatalogCollectionPage
      path={`/categories/${category.slug}`}
      eyebrow="دسته‌بندی"
      title={category.name}
      description={category.description}
      image={category.image}
      filters={filters}
      products={products}
    />
  );
}
