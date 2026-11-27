import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';

import { CatalogCollectionPage } from '@/components/catalog/catalog-collection-page';
import { getPublicCampaignPlacement } from '@/lib/campaigns/public-campaigns';
import {
  hasCatalogFacetFilters,
  isCatalogPageOutOfRange,
  parseCatalogFacetFilters,
  type CatalogSearchParams,
} from '@/lib/catalog/catalog-filter-state';
import { maxCatalogFacetPage } from '@/lib/catalog/catalog-pagination';
import {
  buildCategoryBreadcrumbItems,
  getPublicCatalogCategories,
  getPublicFacetedCatalog,
} from '@/lib/catalog/public-catalog';
import { getPublicRelatedGuideArticles } from '@/lib/guide/public-guide';
import { categorySeoDescription, categorySeoTitle } from '@/lib/seo/content-copy';
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
  const parsedFilters = parseCatalogFacetFilters(rawSearchParams);
  const category = categories.find((candidate) => candidate.slug === slug);

  if (!category || parsedFilters.page > maxCatalogFacetPage) {
    return {
      title: 'دسته‌بندی یافت نشد',
      robots: { index: false, follow: false },
    };
  }

  const products =
    parsedFilters.sort === 'newest' && !hasCatalogFacetFilters(parsedFilters)
      ? await getPublicFacetedCatalog(parsedFilters, { category: category.slug })
      : null;
  if (products && isCatalogPageOutOfRange(parsedFilters, products)) {
    return { title: 'صفحه دسته‌بندی یافت نشد', robots: { index: false, follow: false } };
  }

  return buildStorefrontPageMetadata(settings, {
    pathname: `/categories/${category.slug}`,
    searchParams: rawSearchParams,
    title: categorySeoTitle(category),
    description: categorySeoDescription(category),
    seoTitle: category.seoTitle,
    seoDescription: category.seoDescription,
    seoCanonicalPath: category.seoCanonicalPath,
    seoNoIndex: Boolean(category.seoNoIndex || products?.total === 0),
    seoOgMedia: category.seoOgMedia,
    fallbackMedia: category.image,
  });
}

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const [{ slug }, filters] = await Promise.all([
    params,
    searchParams.then(parseCatalogFacetFilters),
  ]);
  const scope = { category: slug };

  const categories = await getPublicCatalogCategories();
  const category = categories.find((candidate) => candidate.slug === slug);

  if (!category) {
    const destinationPath = await getPublicSeoRedirect(`/categories/${slug}`);
    if (destinationPath) permanentRedirect(destinationPath);
    notFound();
  }
  if (filters.page > maxCatalogFacetPage) notFound();

  const [products, knowledgeArticles, campaignBanner] = await Promise.all([
    getPublicFacetedCatalog(filters, scope),
    getPublicRelatedGuideArticles({ categories: [slug], limit: 3 }),
    getPublicCampaignPlacement('CATEGORY', category.slug),
  ]);

  if (!hasCatalogFacetFilters(filters) && isCatalogPageOutOfRange(filters, products)) {
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
      scope={scope}
      products={products}
      campaignBanner={campaignBanner}
      knowledgeArticles={knowledgeArticles}
      breadcrumbs={buildCategoryBreadcrumbItems(categories, category)}
      collectionLinks={categories
        .filter((candidate) => candidate.parentId === category.id)
        .map((candidate) => ({
          label: candidate.name,
          href: `/categories/${candidate.slug}`,
          activeSubtreeProductCount: candidate.activeSubtreeProductCount,
        }))}
      contextLinkGroups={[
        {
          label: 'برندهای این دسته',
          links: [
            ...new Map(
              products.items
                .filter((product) => product.brand)
                .map(
                  (product) =>
                    [
                      product.brand!.id,
                      {
                        label: product.brand!.name,
                        href: `/brands/${product.brand!.slug}`,
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
