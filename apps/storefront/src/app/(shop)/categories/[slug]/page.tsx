import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';

import { CatalogCollectionPage } from '@/components/catalog/catalog-collection-page';
import {
  buildCategoryBreadcrumbItems,
  getPublicCatalogCategories,
  getPublicCatalogProducts,
  parseCatalogSearchParams,
  type CatalogFilters,
  type CatalogSearchParams,
} from '@/lib/catalog/public-catalog';
import {
  categorySeoDescription,
  categorySeoTitle,
} from '@/lib/seo/content-copy';
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
  const parsedFilters = parseCatalogSearchParams(rawSearchParams);
  const category = categories.find((candidate) => candidate.slug === slug);

  if (!category) {
    return {
      title: 'دسته‌بندی یافت نشد',
      robots: { index: false, follow: false },
    };
  }

  const shouldCheckEmpty = parsedFilters.page === 1 && parsedFilters.sort === 'newest';
  const products = shouldCheckEmpty
    ? await getPublicCatalogProducts({
        page: 1,
        pageSize: parsedFilters.pageSize,
        sort: 'newest',
        category: category.slug,
      })
    : null;
  const emptyCollection = Boolean(shouldCheckEmpty && products?.total === 0);

  return buildStorefrontPageMetadata(settings, {
    pathname: `/categories/${category.slug}`,
    searchParams: rawSearchParams,
    title: categorySeoTitle(category),
    description: categorySeoDescription(category),
    seoTitle: category.seoTitle,
    seoDescription: category.seoDescription,
    seoCanonicalPath: category.seoCanonicalPath,
    seoNoIndex: Boolean(category.seoNoIndex || emptyCollection),
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

  if (filters.sort === 'newest' && filters.page > 1 && filters.page > products.totalPages) {
    notFound();
  }

  return (
    <CatalogCollectionPage
      path={`/categories/${category.slug}`}
      eyebrow="دسته‌بندی"
      title={category.name}
      description={categorySeoDescription(category)}
      image={category.image}
      mobileImage={category.heroMobileImage ?? null}
      filters={filters}
      products={products}
      breadcrumbs={buildCategoryBreadcrumbItems(categories, category)}
      collectionLinks={categories
        .filter((candidate) => candidate.parentId === category.id)
        .map((candidate) => ({
          label: candidate.name,
          href: `/categories/${candidate.slug}`,
        }))}
      contextLinkGroups={[
        {
          label: 'برندهای این دسته',
          links: [
            ...new Map(
              products.items
                .filter((product) => product.brand)
                .map((product) => [
                  product.brand!.id,
                  {
                    label: product.brand!.name,
                    href: `/brands/${product.brand!.slug}`,
                  },
                ]),
            ).values(),
          ].slice(0, 8),
        },
      ]}
    />
  );
}
