import type { components } from '@hamidian/contracts';

import { createServerApiClient } from '@/lib/api/server-client';

export type PublicCatalogCategory = components['schemas']['PublicCatalogCategoryDto'];
export type PublicCatalogBrand = components['schemas']['PublicCatalogBrandDto'];
export type PublicCatalogMedia = components['schemas']['PublicCatalogMediaDto'];
export type PublicCatalogProductSummary = components['schemas']['PublicCatalogProductSummaryDto'];
export type PublicCatalogProductDetail = components['schemas']['PublicCatalogProductDetailDto'];
export type PublicCatalogProductList = components['schemas']['PublicCatalogProductListDto'];

export type CatalogSort = 'newest' | 'price-asc' | 'price-desc' | 'name-asc';

export type CatalogFilters = Readonly<{
  page: number;
  pageSize: number;
  q?: string;
  category?: string;
  brand?: string;
  sort: CatalogSort;
}>;

export type CatalogSearchParams = Readonly<Record<string, string | string[] | undefined>>;

const DEFAULT_PAGE_SIZE = 24;
const SORT_VALUES = new Set<CatalogSort>(['newest', 'price-asc', 'price-desc', 'name-asc']);

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function normalizedText(value: string | string[] | undefined): string | undefined {
  const normalized = firstValue(value)?.trim();

  return normalized || undefined;
}

function positiveInteger(value: string | string[] | undefined): number | undefined {
  const parsed = Number(firstValue(value));

  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

export function parseCatalogSearchParams(searchParams: CatalogSearchParams): CatalogFilters {
  const requestedSort = normalizedText(searchParams.sort);
  const sort =
    requestedSort && SORT_VALUES.has(requestedSort as CatalogSort)
      ? (requestedSort as CatalogSort)
      : 'newest';

  return {
    page: positiveInteger(searchParams.page) ?? 1,
    pageSize: DEFAULT_PAGE_SIZE,
    q: normalizedText(searchParams.q),
    category: normalizedText(searchParams.category),
    brand: normalizedText(searchParams.brand),
    sort,
  };
}

type CatalogFilterOverrides = Partial<Omit<CatalogFilters, 'pageSize'>>;

export function buildCatalogHref(
  filters: CatalogFilters,
  overrides: CatalogFilterOverrides = {},
): string {
  const next = {
    ...filters,
    ...overrides,
  };
  const searchParams = new URLSearchParams();

  if (next.q) {
    searchParams.set('q', next.q);
  }

  if (next.category) {
    searchParams.set('category', next.category);
  }

  if (next.brand) {
    searchParams.set('brand', next.brand);
  }

  if (next.sort !== 'newest') {
    searchParams.set('sort', next.sort);
  }

  if (next.page > 1) {
    searchParams.set('page', String(next.page));
  }

  const query = searchParams.toString();

  return query ? `/products?${query}` : '/products';
}

function createPublicCatalogClient() {
  const apiOrigin = process.env.HAMIDIAN_API_ORIGIN;

  if (!apiOrigin) {
    throw new Error('HAMIDIAN_API_ORIGIN is required for the storefront catalog.');
  }

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

export async function getPublicCatalogIndex(filters: CatalogFilters): Promise<{
  products: PublicCatalogProductList;
  categories: PublicCatalogCategory[];
  brands: PublicCatalogBrand[];
}> {
  const client = createPublicCatalogClient();

  const [productsResult, categoriesResult, brandsResult] = await Promise.all([
    client.GET('/api/v1/catalog/public/products', {
      params: {
        query: {
          page: filters.page,
          pageSize: filters.pageSize,
          q: filters.q,
          category: filters.category,
          brand: filters.brand,
          sort: filters.sort,
        },
      },
    }),
    client.GET('/api/v1/catalog/public/categories'),
    client.GET('/api/v1/catalog/public/brands'),
  ]);

  assertSuccessfulResponse(productsResult.response, productsResult.data, 'storefront products');
  assertSuccessfulResponse(
    categoriesResult.response,
    categoriesResult.data,
    'storefront categories',
  );
  assertSuccessfulResponse(brandsResult.response, brandsResult.data, 'storefront brands');

  return {
    products: productsResult.data,
    categories: categoriesResult.data,
    brands: brandsResult.data,
  };
}

export async function getPublicCatalogProduct(
  slug: string,
): Promise<PublicCatalogProductDetail | null> {
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
}
