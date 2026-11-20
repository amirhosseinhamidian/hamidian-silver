import type { components } from '@hamidian/contracts';
import { unstable_cache } from 'next/cache';
import { cache } from 'react';

import { createServerApiClient } from '@/lib/api/server-client';
import {
  catalogFacetQuery,
  emptyCatalogFacets,
  type CatalogFacetFilters,
  type CatalogFacetQuery,
  type CatalogFacetScope,
  type CatalogFilters,
  type CatalogListing,
  type CatalogSort,
} from './catalog-filter-state';
import { maxCatalogFacetPage } from './catalog-pagination';
import { normalizeCatalogSearchText } from '@/lib/catalog/search-normalization';

export type PublicCatalogCategory = components['schemas']['PublicCatalogCategoryDto'];
export type PublicCatalogBrand = components['schemas']['PublicCatalogBrandDto'];
export type PublicCatalogCategoryPage = components['schemas']['PublicCatalogCategoryPageDto'];
export type PublicCatalogBrandPage = components['schemas']['PublicCatalogBrandPageDto'];
export type PublicCatalogMedia = components['schemas']['PublicCatalogMediaDto'];
export type PublicCatalogProductSummary = components['schemas']['PublicCatalogProductSummaryDto'];
export type PublicCatalogProductDetail = components['schemas']['PublicCatalogProductDetailDto'];
export type PublicCatalogProductList = components['schemas']['PublicCatalogProductListDto'];
export type PublicCatalogProductSuggestion =
  components['schemas']['PublicCatalogProductSuggestionDto'];
export type PublicCatalogNamedSuggestion = components['schemas']['PublicCatalogNamedSuggestionDto'];
export type PublicCatalogProductSuggestions =
  components['schemas']['PublicCatalogProductSuggestionsDto'];

export {
  buildCatalogCollectionHref,
  buildCatalogHref,
  isCatalogPageOutOfRange,
  parseCatalogSearchParams,
  type CatalogFilters,
  type CatalogSearchParams,
  type CatalogSort,
} from './catalog-filter-state';

function categoryDepth(
  categoriesById: ReadonlyMap<string, PublicCatalogCategoryPage>,
  category: PublicCatalogCategoryPage,
): number {
  let depth = 0;
  let current = category;
  const visited = new Set<string>();
  while (current.parentId && !visited.has(current.parentId)) {
    visited.add(current.parentId);
    const parent = categoriesById.get(current.parentId);
    if (!parent) break;
    depth += 1;
    current = parent;
  }
  return depth;
}

export function selectPrimaryCatalogCategory(
  categories: readonly PublicCatalogCategoryPage[],
  assignedCategories: readonly Readonly<{ id: string }>[],
  primaryCategoryId?: string,
): PublicCatalogCategoryPage | null {
  const byId = new Map(categories.map((category) => [category.id, category] as const));
  if (primaryCategoryId && assignedCategories.some(({ id }) => id === primaryCategoryId)) {
    const preferred = byId.get(primaryCategoryId);
    if (preferred) return preferred;
  }
  return (
    assignedCategories
      .flatMap(({ id }) => {
        const category = byId.get(id);
        return category ? [category] : [];
      })
      .sort(
        (left, right) =>
          categoryDepth(byId, right) - categoryDepth(byId, left) ||
          left.sortOrder - right.sortOrder ||
          left.name.localeCompare(right.name, 'fa'),
      )[0] ?? null
  );
}

export function buildCategoryBreadcrumbItems(
  categories: readonly PublicCatalogCategoryPage[],
  category: PublicCatalogCategoryPage,
): ReadonlyArray<Readonly<{ label: string; href: string }>> {
  const byId = new Map(categories.map((item) => [item.id, item] as const));
  const ancestors: PublicCatalogCategoryPage[] = [];
  const visited = new Set<string>();
  let current = category;

  while (current.parentId && !visited.has(current.parentId)) {
    visited.add(current.parentId);
    const parent = byId.get(current.parentId);
    if (!parent) break;
    ancestors.push(parent);
    current = parent;
  }

  return [
    { label: 'خانه', href: '/' },
    { label: 'دسته‌بندی‌ها', href: '/categories' },
    ...ancestors.reverse().map((item) => ({
      label: item.name,
      href: `/categories/${item.slug}`,
    })),
    { label: category.name, href: `/categories/${category.slug}` },
  ];
}

function publicCatalogApiOrigin(): string {
  const apiOrigin = process.env.HAMIDIAN_API_ORIGIN;
  if (!apiOrigin) {
    throw new Error('HAMIDIAN_API_ORIGIN is required for the storefront catalog.');
  }
  return apiOrigin;
}

function createPublicCatalogClient(apiOrigin = publicCatalogApiOrigin()) {
  return createServerApiClient({ apiOrigin });
}

function assertSuccessfulResponse(
  response: Response,
  data: unknown,
  resourceName: string,
): asserts data {
  if (!response.ok || data === undefined) {
    throw new Error(`Failed to load ${resourceName} from the public catalog.`);
  }
}

const getPublicCatalogProductsForRequest = cache(
  async (
    page: number,
    pageSize: number,
    q: string | undefined,
    category: string | undefined,
    brand: string | undefined,
    country: string | undefined,
    sort: CatalogSort,
  ): Promise<PublicCatalogProductList> => {
    const client = createPublicCatalogClient();
    const result = await client.GET('/api/v1/catalog/public/products', {
      params: {
        query: {
          page,
          pageSize,
          q,
          category,
          brand,
          country,
          sort,
        },
      },
    });

    assertSuccessfulResponse(result.response, result.data, 'storefront products');

    return result.data;
  },
);

export function getPublicCatalogProducts(
  filters: CatalogFilters,
): Promise<PublicCatalogProductList> {
  return getPublicCatalogProductsForRequest(
    filters.page,
    filters.pageSize,
    filters.q,
    filters.category,
    filters.brand,
    filters.country,
    filters.sort,
  );
}

async function readPublicFacetedCatalog(
  body: CatalogFacetQuery,
  signal?: AbortSignal,
): Promise<CatalogListing> {
  const result = await createPublicCatalogClient().POST('/api/v1/catalog/public/search/facets', {
    body,
    signal,
    cache: 'no-store',
  });
  if (result.response.status === 400) {
    return {
      items: [],
      page: body.page ?? 1,
      pageSize: body.pageSize ?? 24,
      total: 0,
      totalPages: 0,
      facets: emptyCatalogFacets,
      invalidFilters: true,
    };
  }
  assertSuccessfulResponse(result.response, result.data, 'filtered storefront products');
  return result.data;
}

const getPublicFacetedCatalogForRequest = cache(async (serialized: string) => {
  const body = JSON.parse(serialized) as CatalogFacetQuery;
  const listing = await readPublicFacetedCatalog(body);
  const missingCategories = new Set(
    body.categories?.filter(
      (value) => !listing.facets.categories.some((item) => item.value === value),
    ),
  );
  const missingBrands = new Set(
    body.brands?.filter((value) => !listing.facets.brands.some((item) => item.value === value)),
  );
  if (!missingCategories.size && !missingBrands.size) return listing;

  const apiOrigin = publicCatalogApiOrigin();
  // The current facet response can know a selection before the directory cache does.
  const [categories, brands] = await Promise.all([
    missingCategories.size
      ? readPublicCatalogCategories(apiOrigin, 'no-store').catch(() => [])
      : [],
    missingBrands.size ? readPublicCatalogBrands(apiOrigin, 'no-store').catch(() => []) : [],
  ]);
  return {
    ...listing,
    facets: {
      ...listing.facets,
      categories: [
        ...listing.facets.categories,
        ...categories
          .filter(({ slug }) => missingCategories.has(slug))
          .map(({ slug, name }) => ({ value: slug, label: name, count: 0 })),
      ],
      brands: [
        ...listing.facets.brands,
        ...brands
          .filter(({ slug }) => missingBrands.has(slug))
          .map(({ slug, name }) => ({ value: slug, label: name, count: 0 })),
      ],
    },
  };
});

export async function getPublicFacetedCatalog(
  filters: CatalogFacetFilters,
  scope?: CatalogFacetScope,
  signal?: AbortSignal,
): Promise<CatalogListing> {
  const body = catalogFacetQuery(filters, scope);
  const listing = await (signal
    ? readPublicFacetedCatalog(body, signal)
    : getPublicFacetedCatalogForRequest(JSON.stringify(body)));
  return {
    ...listing,
    totalPages: Math.min(listing.totalPages, maxCatalogFacetPage),
    ...(filters.page > maxCatalogFacetPage ? { items: [], page: filters.page } : {}),
  };
}

export async function getPublicCatalogProductSuggestions(
  query: string,
  limit = 8,
  signal?: AbortSignal,
): Promise<PublicCatalogProductSuggestions> {
  const client = createPublicCatalogClient();
  const result = await client.GET('/api/v1/catalog/public/search/suggestions', {
    params: {
      query: {
        q: normalizeCatalogSearchText(query),
        limit,
      },
    },
    signal,
    cache: 'no-store',
  });

  if (result.response.status === 429) throw new CatalogSuggestionsBusyError();
  assertSuccessfulResponse(result.response, result.data, 'product search suggestions');

  return result.data;
}

export class CatalogSuggestionsBusyError extends Error {}

async function readPublicCatalogCategories(
  apiOrigin: string,
  requestCache?: RequestCache,
): Promise<PublicCatalogCategoryPage[]> {
  const client = createPublicCatalogClient(apiOrigin);
  const result = await client.GET('/api/v1/catalog/public/categories', { cache: requestCache });

  assertSuccessfulResponse(result.response, result.data, 'storefront categories');

  return result.data;
}

const getCachedPublicCatalogCategories = unstable_cache(
  (apiOrigin: string) => readPublicCatalogCategories(apiOrigin),
  ['storefront-public-catalog-categories'],
  { revalidate: 60 },
);

async function readPublicCatalogBrands(
  apiOrigin: string,
  requestCache?: RequestCache,
): Promise<PublicCatalogBrandPage[]> {
  const client = createPublicCatalogClient(apiOrigin);
  const result = await client.GET('/api/v1/catalog/public/brands', { cache: requestCache });

  assertSuccessfulResponse(result.response, result.data, 'storefront brands');

  return result.data;
}

const getCachedPublicCatalogBrands = unstable_cache(
  (apiOrigin: string) => readPublicCatalogBrands(apiOrigin),
  ['storefront-public-catalog-brands'],
  { revalidate: 60 },
);

export const getPublicCatalogCategories = cache(async (): Promise<PublicCatalogCategoryPage[]> =>
  getCachedPublicCatalogCategories(publicCatalogApiOrigin()),
);

export const getPublicCatalogBrands = cache(async (): Promise<PublicCatalogBrandPage[]> =>
  getCachedPublicCatalogBrands(publicCatalogApiOrigin()),
);

export async function getPublicCatalogIndex(filters: CatalogFilters): Promise<{
  products: PublicCatalogProductList;
  categories: PublicCatalogCategory[];
  brands: PublicCatalogBrand[];
}> {
  const [products, categories, brands] = await Promise.all([
    getPublicCatalogProducts(filters),
    getPublicCatalogCategories(),
    getPublicCatalogBrands(),
  ]);

  return {
    products,
    categories: categories.filter((category) => category.hasProducts === true),
    brands: brands.filter((brand) => brand.hasProducts === true),
  };
}

export const getPublicCatalogProduct = cache(
  async (slug: string): Promise<PublicCatalogProductDetail | null> => {
    const client = createPublicCatalogClient();
    const result = await client.GET('/api/v1/catalog/public/products/{slug}', {
      params: {
        path: {
          slug,
        },
      },
    });

    if (result.response.status === 404) {
      return null;
    }

    assertSuccessfulResponse(result.response, result.data, 'storefront product');

    return result.data;
  },
);

export async function getPublicRelatedProducts(
  slug: string,
  page = 1,
  pageSize = 8,
): Promise<PublicCatalogProductList> {
  const client = createPublicCatalogClient();
  const result = await client.GET('/api/v1/catalog/public/products/{slug}/related', {
    params: { path: { slug }, query: { page: String(page), pageSize: String(pageSize) } },
  });
  assertSuccessfulResponse(result.response, result.data, 'related products');
  return result.data;
}
