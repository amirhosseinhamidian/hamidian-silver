import 'server-only';

import { cookies } from 'next/headers';

import { requestAdminCatalog, readJsonResponse } from '@/lib/catalog/catalog-api';
import {
  parseAdminProduct,
  parseAdminCategories,
  parseCatalogLookups,
  parseCatalogSizes,
  parseProductList,
  type AdminProduct,
  type AdminCategory,
  type CatalogFilters,
  type CatalogLookup,
  type CatalogSize,
  type ProductListResult,
} from '@/lib/catalog/catalog-model';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';

export type CatalogResource<T> = Readonly<{ data: T | null; failed: boolean }>;

export type ProductManagementData = Readonly<{
  products: CatalogResource<ProductListResult>;
  brands: CatalogResource<readonly CatalogLookup[]>;
  categories: CatalogResource<readonly CatalogLookup[]>;
}>;

export type ProductFormData = Readonly<{
  product: AdminProduct | null;
  brands: readonly CatalogLookup[];
  countries: readonly CatalogLookup[];
  categories: readonly CatalogLookup[];
  sizes: readonly CatalogSize[];
}>;

export type CategoryManagementData = CatalogResource<readonly AdminCategory[]>;

async function load<T>(
  request: Promise<Response>,
  parse: (value: unknown) => T | null,
): Promise<CatalogResource<T>> {
  try {
    const response = await request;
    if (!response.ok) return { data: null, failed: true };
    const data = parse(await readJsonResponse(response));
    return data === null ? { data: null, failed: true } : { data, failed: false };
  } catch {
    return { data: null, failed: true };
  }
}

async function accessToken(): Promise<string> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) throw new Error('Authenticated admin session is required.');
  return token;
}

export async function loadProductManagement(
  filters: CatalogFilters,
): Promise<ProductManagementData> {
  const token = await accessToken();
  const query = new URLSearchParams();
  if (filters.q) query.set('q', filters.q);
  if (filters.status) query.set('status', filters.status);
  if (filters.brandId) query.set('brandId', filters.brandId);
  if (filters.categoryId) query.set('categoryId', filters.categoryId);
  query.set('page', String(filters.page));
  query.set('limit', String(filters.limit));

  const [products, brands, categories] = await Promise.all([
    load(
      requestAdminCatalog(`/api/v1/catalog/products?${query.toString()}`, token),
      parseProductList,
    ),
    load(requestAdminCatalog('/api/v1/catalog/brands', token), parseCatalogLookups),
    load(requestAdminCatalog('/api/v1/catalog/categories', token), parseCatalogLookups),
  ]);

  return { products, brands, categories };
}

export async function loadProductForm(productId?: string): Promise<ProductFormData | null> {
  const token = await accessToken();
  const productRequest = productId
    ? load(
        requestAdminCatalog(`/api/v1/catalog/products/${encodeURIComponent(productId)}`, token),
        parseAdminProduct,
      )
    : Promise.resolve({ data: null, failed: false } as CatalogResource<AdminProduct>);
  const [product, brands, countries, categories, sizes] = await Promise.all([
    productRequest,
    load(requestAdminCatalog('/api/v1/catalog/brands', token), parseCatalogLookups),
    load(requestAdminCatalog('/api/v1/catalog/countries', token), parseCatalogLookups),
    load(requestAdminCatalog('/api/v1/catalog/categories', token), parseCatalogLookups),
    load(requestAdminCatalog('/api/v1/catalog/sizes', token), parseCatalogSizes),
  ]);

  if (
    product.failed ||
    brands.failed ||
    countries.failed ||
    categories.failed ||
    sizes.failed ||
    !brands.data ||
    !countries.data ||
    !categories.data ||
    !sizes.data
  ) {
    return null;
  }

  return {
    product: product.data,
    brands: brands.data,
    countries: countries.data,
    categories: categories.data,
    sizes: sizes.data,
  };
}

export async function loadCategoryManagement(): Promise<CategoryManagementData> {
  const token = await accessToken();
  return load(requestAdminCatalog('/api/v1/catalog/categories', token), parseAdminCategories);
}
