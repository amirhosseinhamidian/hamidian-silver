import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';

import { CatalogCollectionPage } from '@/components/catalog/catalog-collection-page';
import {
  hasCatalogFacetFilters,
  isCatalogPageOutOfRange,
  parseCatalogFacetFilters,
  type CatalogSearchParams,
} from '@/lib/catalog/catalog-filter-state';
import { maxCatalogFacetPage } from '@/lib/catalog/catalog-pagination';
import { getPublicCatalogBrands, getPublicFacetedCatalog } from '@/lib/catalog/public-catalog';
import { getPublicRelatedGuideArticles } from '@/lib/guide/public-guide';
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
  const parsedFilters = parseCatalogFacetFilters(rawSearchParams);
  const brand = brands.find((candidate) => candidate.slug === slug);

  if (!brand || parsedFilters.page > maxCatalogFacetPage) {
    return {
      title: 'برند یافت نشد',
      robots: { index: false, follow: false },
    };
  }

  const products =
    parsedFilters.sort === 'newest' && !hasCatalogFacetFilters(parsedFilters)
      ? await getPublicFacetedCatalog(parsedFilters, { brand: brand.slug })
      : null;
  if (products && isCatalogPageOutOfRange(parsedFilters, products)) {
    return { title: 'صفحه برند یافت نشد', robots: { index: false, follow: false } };
  }

  return buildStorefrontPageMetadata(settings, {
    pathname: `/brands/${brand.slug}`,
    searchParams: rawSearchParams,
    title: brandSeoTitle(brand),
    description: brandSeoDescription(brand),
    seoTitle: brand.seoTitle,
    seoDescription: brand.seoDescription,
    seoCanonicalPath: brand.seoCanonicalPath,
    seoNoIndex: Boolean(brand.seoNoIndex || products?.total === 0),
    seoOgMedia: brand.seoOgMedia,
    fallbackMedia: brand.heroImage ?? brand.image,
  });
}

export default async function BrandPage({ params, searchParams }: BrandPageProps) {
  const [{ slug }, filters] = await Promise.all([
    params,
    searchParams.then(parseCatalogFacetFilters),
  ]);
  const scope = { brand: slug };

  const brands = await getPublicCatalogBrands();
  const brand = brands.find((candidate) => candidate.slug === slug);

  if (!brand) {
    const destinationPath = await getPublicSeoRedirect(`/brands/${slug}`);
    if (destinationPath) permanentRedirect(destinationPath);
    notFound();
  }
  if (filters.page > maxCatalogFacetPage) notFound();

  const [products, knowledgeArticles] = await Promise.all([
    getPublicFacetedCatalog(filters, scope),
    getPublicRelatedGuideArticles({ brand: slug, limit: 3 }),
  ]);
  if (!hasCatalogFacetFilters(filters) && isCatalogPageOutOfRange(filters, products)) {
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
      scope={scope}
      products={products}
      knowledgeArticles={knowledgeArticles}
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
