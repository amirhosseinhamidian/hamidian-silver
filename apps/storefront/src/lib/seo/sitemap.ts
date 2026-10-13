import type { MetadataRoute } from 'next';

import {
  PUBLIC_CONTENT_PAGE_KEYS,
  PUBLIC_CONTENT_PAGE_ROUTES,
} from '@/lib/content/public-content-page';
import {
  getStorefrontAbsoluteUrl,
  getStorefrontMetadataBase,
  resolveStorefrontCanonicalPath,
} from '@/lib/seo/metadata';
import {
  getAllPublicGuideArticles,
  type PublicGuideArticleSummary,
} from '@/lib/guide/public-guide';
import { getPublicSeoSitemap, type PublicSeoSitemap } from '@/lib/seo/public-sitemap-source';

type SitemapProduct = PublicSeoSitemap['products'][number];
type StorefrontSitemapSources = PublicSeoSitemap &
  Readonly<{ guideArticles?: readonly PublicGuideArticleSummary[] }>;

function sitemapUrl(pathname: string, metadataBase: URL): string {
  return getStorefrontAbsoluteUrl(pathname, metadataBase);
}

function validLastModified(value: string | null | undefined): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function latestDate(values: Iterable<string | Date | null | undefined>): Date | undefined {
  let latest: Date | undefined;
  for (const value of values) {
    const date = value instanceof Date ? value : validLastModified(value);
    if (date && (!latest || date.getTime() > latest.getTime())) latest = date;
  }
  return latest;
}

function lastModifiedFields(values: Iterable<string | Date | null | undefined>) {
  const lastModified = latestDate(values);
  return lastModified ? { lastModified } : {};
}

function populatedCategoryIds(
  products: readonly SitemapProduct[],
  categories: PublicSeoSitemap['categories'],
): Set<string> {
  const populated = new Set(products.flatMap((product) => product.categoryIds));
  const byId = new Map(categories.map((category) => [category.id, category] as const));

  for (const categoryId of [...populated]) {
    let current = byId.get(categoryId);
    const visited = new Set<string>();
    while (current?.parentId && !visited.has(current.parentId)) {
      visited.add(current.parentId);
      populated.add(current.parentId);
      current = byId.get(current.parentId);
    }
  }

  return populated;
}

function updateLatest(map: Map<string, Date>, key: string, value: string): void {
  const date = validLastModified(value);
  if (!date) return;
  const current = map.get(key);
  if (!current || date.getTime() > current.getTime()) map.set(key, date);
}

export function buildStorefrontSitemap(
  sources: StorefrontSitemapSources,
  metadataBase: URL = getStorefrontMetadataBase(),
): MetadataRoute.Sitemap {
  const entries = new Map<string, MetadataRoute.Sitemap[number]>();
  const add = (entry: MetadataRoute.Sitemap[number]) => {
    if (!entries.has(entry.url)) entries.set(entry.url, entry);
  };

  const categoryIdsWithProducts = populatedCategoryIds(sources.products, sources.categories);
  const categoryById = new Map(
    sources.categories.map((category) => [category.id, category] as const),
  );
  const categoryProductUpdates = new Map<string, Date>();
  const brandProductUpdates = new Map<string, Date>();

  for (const product of sources.products) {
    if (product.brandId) updateLatest(brandProductUpdates, product.brandId, product.updatedAt);

    for (const categoryId of product.categoryIds) {
      let current = categoryById.get(categoryId);
      const visited = new Set<string>();
      while (current && !visited.has(current.id)) {
        visited.add(current.id);
        updateLatest(categoryProductUpdates, current.id, product.updatedAt);
        current = current.parentId ? categoryById.get(current.parentId) : undefined;
      }
    }
  }

  const brandIdsWithProducts = new Set(
    sources.products.flatMap((product) => (product.brandId ? [product.brandId] : [])),
  );
  const productUpdatedAt = sources.products.map((product) => product.updatedAt);
  const categoryUpdatedAt = sources.categories.map((category) => category.updatedAt);
  const brandUpdatedAt = sources.brands.map((brand) => brand.updatedAt);
  const guideArticles = sources.guideArticles ?? [];

  add({ url: sitemapUrl('/', metadataBase) });
  if (sources.products.length > 0) {
    add({
      url: sitemapUrl('/products', metadataBase),
      ...lastModifiedFields(productUpdatedAt),
    });
  }
  if (categoryIdsWithProducts.size > 0) {
    add({
      url: sitemapUrl('/categories', metadataBase),
      ...lastModifiedFields([...categoryUpdatedAt, ...productUpdatedAt]),
    });
  }
  if (brandIdsWithProducts.size > 0) {
    add({
      url: sitemapUrl('/brands', metadataBase),
      ...lastModifiedFields([...brandUpdatedAt, ...productUpdatedAt]),
    });
  }
  if (guideArticles.length > 0) {
    add({
      url: sitemapUrl('/guide', metadataBase),
      ...lastModifiedFields(guideArticles.map((article) => article.updatedAt)),
    });
  }

  const contentPageByKey = new Map(sources.contentPages.map((page) => [page.key, page] as const));
  for (const key of PUBLIC_CONTENT_PAGE_KEYS) {
    const page = contentPageByKey.get(key);
    if (page?.seoNoIndex) continue;
    const fallbackPath = PUBLIC_CONTENT_PAGE_ROUTES[key];
    add({
      url: sitemapUrl(
        resolveStorefrontCanonicalPath(page?.seoCanonicalPath, fallbackPath),
        metadataBase,
      ),
      ...lastModifiedFields([page?.updatedAt]),
      ...(page?.imageUrl ? { images: [sitemapUrl(page.imageUrl, metadataBase)] } : {}),
    });
  }

  for (const category of sources.categories) {
    if (category.seoNoIndex || !categoryIdsWithProducts.has(category.id)) continue;
    const fallbackPath = `/categories/${category.slug}`;
    add({
      url: sitemapUrl(
        resolveStorefrontCanonicalPath(category.seoCanonicalPath, fallbackPath),
        metadataBase,
      ),
      ...lastModifiedFields([category.updatedAt, categoryProductUpdates.get(category.id)]),
      ...(category.imageUrl ? { images: [sitemapUrl(category.imageUrl, metadataBase)] } : {}),
    });
  }

  for (const brand of sources.brands) {
    if (brand.seoNoIndex || !brandIdsWithProducts.has(brand.id)) continue;
    const fallbackPath = `/brands/${brand.slug}`;
    add({
      url: sitemapUrl(
        resolveStorefrontCanonicalPath(brand.seoCanonicalPath, fallbackPath),
        metadataBase,
      ),
      ...lastModifiedFields([brand.updatedAt, brandProductUpdates.get(brand.id)]),
      ...(brand.imageUrl ? { images: [sitemapUrl(brand.imageUrl, metadataBase)] } : {}),
    });
  }

  for (const product of sources.products) {
    if (product.seoNoIndex) continue;
    const fallbackPath = `/products/${product.slug}`;
    add({
      url: sitemapUrl(
        resolveStorefrontCanonicalPath(product.seoCanonicalPath, fallbackPath),
        metadataBase,
      ),
      ...lastModifiedFields([product.updatedAt]),
      ...(product.imageUrl ? { images: [sitemapUrl(product.imageUrl, metadataBase)] } : {}),
    });
  }

  for (const article of guideArticles) {
    if (article.seoNoIndex) continue;
    const fallbackPath = `/guide/${article.slug}`;
    const imageUrl = article.seoOgMedia?.url || article.heroMedia?.url;
    add({
      url: sitemapUrl(
        resolveStorefrontCanonicalPath(article.seoCanonicalPath, fallbackPath),
        metadataBase,
      ),
      ...lastModifiedFields([article.updatedAt]),
      ...(imageUrl ? { images: [sitemapUrl(imageUrl, metadataBase)] } : {}),
    });
  }

  return [...entries.values()];
}

export async function getStorefrontSitemap(): Promise<MetadataRoute.Sitemap> {
  const [sources, guideArticles] = await Promise.all([
    getPublicSeoSitemap(),
    getAllPublicGuideArticles(),
  ]);
  return buildStorefrontSitemap({ ...sources, guideArticles });
}
