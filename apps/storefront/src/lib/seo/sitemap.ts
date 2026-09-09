import type { MetadataRoute } from 'next';

import {
  getPublicCatalogBrands,
  getPublicCatalogCategories,
  getPublicCatalogProducts,
  type PublicCatalogBrandPage,
  type PublicCatalogCategoryPage,
  type PublicCatalogProductSummary,
} from '@/lib/catalog/public-catalog';
import {
  getPublicContentPage,
  PUBLIC_CONTENT_PAGE_KEYS,
  PUBLIC_CONTENT_PAGE_ROUTES,
  type PublicContentPage,
} from '@/lib/content/public-content-page';
import { getStorefrontAbsoluteUrl, getStorefrontMetadataBase } from '@/lib/seo/metadata';

const SITEMAP_PAGE_SIZE = 48;

type SitemapSources = Readonly<{
  products: readonly PublicCatalogProductSummary[];
  categories: readonly PublicCatalogCategoryPage[];
  brands: readonly PublicCatalogBrandPage[];
  contentPages: readonly PublicContentPage[];
}>;

function sitemapUrl(pathname: string, metadataBase: URL): string {
  return getStorefrontAbsoluteUrl(pathname, metadataBase);
}

function preferredMediaUrl(...candidates: Array<string | null | undefined>): string | null {
  return candidates.find((candidate): candidate is string => Boolean(candidate)) ?? null;
}

export function buildStorefrontSitemap(
  sources: SitemapSources,
  metadataBase: URL = getStorefrontMetadataBase(),
): MetadataRoute.Sitemap {
  const entries = new Map<string, MetadataRoute.Sitemap[number]>();
  const add = (entry: MetadataRoute.Sitemap[number]) => {
    if (!entries.has(entry.url)) entries.set(entry.url, entry);
  };

  add({ url: sitemapUrl('/', metadataBase), changeFrequency: 'weekly', priority: 1 });
  add({ url: sitemapUrl('/products', metadataBase), changeFrequency: 'daily', priority: 0.9 });
  add({ url: sitemapUrl('/brands', metadataBase), changeFrequency: 'weekly', priority: 0.7 });

  for (const page of sources.contentPages) {
    if (page.seoNoIndex) continue;
    const imageUrl = preferredMediaUrl(page.seoOgMedia?.url, page.heroMedia?.url);
    add({
      url: sitemapUrl(
        page.seoCanonicalPath?.trim() || PUBLIC_CONTENT_PAGE_ROUTES[page.key],
        metadataBase,
      ),
      changeFrequency: 'monthly',
      priority: page.key === 'ABOUT' || page.key === 'SERVICES' ? 0.6 : 0.5,
      ...(imageUrl ? { images: [sitemapUrl(imageUrl, metadataBase)] } : {}),
    });
  }

  for (const category of sources.categories) {
    if (category.seoNoIndex) continue;
    const imageUrl = preferredMediaUrl(category.seoOgMedia?.url, category.image?.url);
    add({
      url: sitemapUrl(
        category.seoCanonicalPath?.trim() || `/categories/${category.slug}`,
        metadataBase,
      ),
      changeFrequency: 'weekly',
      priority: 0.7,
      ...(imageUrl ? { images: [sitemapUrl(imageUrl, metadataBase)] } : {}),
    });
  }

  for (const brand of sources.brands) {
    if (brand.seoNoIndex) continue;
    const imageUrl = preferredMediaUrl(
      brand.seoOgMedia?.url,
      brand.heroImage?.url,
      brand.image?.url,
    );
    add({
      url: sitemapUrl(brand.seoCanonicalPath?.trim() || `/brands/${brand.slug}`, metadataBase),
      changeFrequency: 'weekly',
      priority: 0.7,
      ...(imageUrl ? { images: [sitemapUrl(imageUrl, metadataBase)] } : {}),
    });
  }

  for (const product of sources.products) {
    if (product.seoNoIndex) continue;
    add({
      url: sitemapUrl(
        product.seoCanonicalPath?.trim() || `/products/${product.slug}`,
        metadataBase,
      ),
      changeFrequency: 'weekly',
      priority: 0.8,
      ...(product.primaryMedia?.url
        ? { images: [sitemapUrl(product.primaryMedia.url, metadataBase)] }
        : {}),
    });
  }

  return [...entries.values()];
}

async function getAllPublicProducts(): Promise<PublicCatalogProductSummary[]> {
  const firstPage = await getPublicCatalogProducts({
    page: 1,
    pageSize: SITEMAP_PAGE_SIZE,
    sort: 'newest',
  });
  const products = [...firstPage.items];

  for (let page = 2; page <= firstPage.totalPages; page += 1) {
    const nextPage = await getPublicCatalogProducts({
      page,
      pageSize: SITEMAP_PAGE_SIZE,
      sort: 'newest',
    });
    products.push(...nextPage.items);
  }

  return products;
}

export async function getStorefrontSitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories, brands, contentPages] = await Promise.all([
    getAllPublicProducts(),
    getPublicCatalogCategories(),
    getPublicCatalogBrands(),
    Promise.all(PUBLIC_CONTENT_PAGE_KEYS.map((key) => getPublicContentPage(key))),
  ]);

  return buildStorefrontSitemap({ products, categories, brands, contentPages });
}
