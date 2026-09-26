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

function validLastModified(value: string | null | undefined): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function latestDate(values: Array<Date | undefined>): Date | undefined {
  return values
    .filter((value): value is Date => Boolean(value))
    .sort((left, right) => right.getTime() - left.getTime())[0];
}

function lastModifiedFields(...values: Array<string | null | undefined>) {
  const lastModified = latestDate(values.map(validLastModified));
  return lastModified ? { lastModified } : {};
}

function populatedCategoryIds(
  products: readonly PublicCatalogProductSummary[],
  categories: readonly PublicCatalogCategoryPage[],
): Set<string> {
  const populated = new Set(products.flatMap((product) => product.categories.map(({ id }) => id)));
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

export function buildStorefrontSitemap(
  sources: SitemapSources,
  metadataBase: URL = getStorefrontMetadataBase(),
): MetadataRoute.Sitemap {
  const entries = new Map<string, MetadataRoute.Sitemap[number]>();
  const add = (entry: MetadataRoute.Sitemap[number]) => {
    if (!entries.has(entry.url)) entries.set(entry.url, entry);
  };

  const categoryIdsWithProducts = populatedCategoryIds(sources.products, sources.categories);
  const categoryById = new Map(sources.categories.map((category) => [category.id, category] as const));
  const categoryProductUpdates = new Map<string, string[]>();
  const brandProductUpdates = new Map<string, string[]>();

  for (const product of sources.products) {
    if (product.updatedAt && product.brand) {
      const updates = brandProductUpdates.get(product.brand.id) ?? [];
      updates.push(product.updatedAt);
      brandProductUpdates.set(product.brand.id, updates);
    }

    for (const assignedCategory of product.categories) {
      let current = categoryById.get(assignedCategory.id);
      const visited = new Set<string>();
      while (current && !visited.has(current.id)) {
        visited.add(current.id);
        if (product.updatedAt) {
          const updates = categoryProductUpdates.get(current.id) ?? [];
          updates.push(product.updatedAt);
          categoryProductUpdates.set(current.id, updates);
        }
        current = current.parentId ? categoryById.get(current.parentId) : undefined;
      }
    }
  }

  const brandIdsWithProducts = new Set(
    sources.products.flatMap((product) => (product.brand ? [product.brand.id] : [])),
  );
  const productUpdatedAt = sources.products.map((product) => product.updatedAt);
  const categoryUpdatedAt = sources.categories.map((category) => category.updatedAt);
  const brandUpdatedAt = sources.brands.map((brand) => brand.updatedAt);

  add({ url: sitemapUrl('/', metadataBase) });
  add({
    url: sitemapUrl('/products', metadataBase),
    ...lastModifiedFields(...productUpdatedAt),
  });
  add({
    url: sitemapUrl('/categories', metadataBase),
    ...lastModifiedFields(...categoryUpdatedAt, ...productUpdatedAt),
  });
  add({
    url: sitemapUrl('/brands', metadataBase),
    ...lastModifiedFields(...brandUpdatedAt, ...productUpdatedAt),
  });

  for (const page of sources.contentPages) {
    if (page.seoNoIndex) continue;
    const imageUrl = preferredMediaUrl(page.seoOgMedia?.url, page.heroMedia?.url);
    add({
      url: sitemapUrl(
        page.seoCanonicalPath?.trim() || PUBLIC_CONTENT_PAGE_ROUTES[page.key],
        metadataBase,
      ),
      ...lastModifiedFields(page.updatedAt),
      ...(imageUrl ? { images: [sitemapUrl(imageUrl, metadataBase)] } : {}),
    });
  }

  for (const category of sources.categories) {
    if (category.seoNoIndex || !categoryIdsWithProducts.has(category.id)) continue;
    const imageUrl = preferredMediaUrl(category.seoOgMedia?.url, category.image?.url);
    add({
      url: sitemapUrl(
        category.seoCanonicalPath?.trim() || `/categories/${category.slug}`,
        metadataBase,
      ),
      ...lastModifiedFields(
        category.updatedAt,
        ...(categoryProductUpdates.get(category.id) ?? []),
      ),
      ...(imageUrl ? { images: [sitemapUrl(imageUrl, metadataBase)] } : {}),
    });
  }

  for (const brand of sources.brands) {
    if (brand.seoNoIndex || !brandIdsWithProducts.has(brand.id)) continue;
    const imageUrl = preferredMediaUrl(
      brand.seoOgMedia?.url,
      brand.heroImage?.url,
      brand.image?.url,
    );
    add({
      url: sitemapUrl(brand.seoCanonicalPath?.trim() || `/brands/${brand.slug}`, metadataBase),
      ...lastModifiedFields(brand.updatedAt, ...(brandProductUpdates.get(brand.id) ?? [])),
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
      ...lastModifiedFields(product.updatedAt),
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
