import type { components } from '@hamidian/contracts';

import { normalizeCatalogSearchText } from '@/lib/catalog/search-normalization';

export type CatalogSort = 'newest' | 'price-asc' | 'price-desc' | 'name-asc';

export type CatalogFilters = Readonly<{
  page: number;
  pageSize: number;
  q?: string;
  category?: string;
  brand?: string;
  country?: string;
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

function normalizedSearchText(value: string | string[] | undefined): string | undefined {
  const normalized = normalizeCatalogSearchText(firstValue(value) ?? '');

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
    q: normalizedSearchText(searchParams.q),
    category: normalizedText(searchParams.category),
    brand: normalizedText(searchParams.brand),
    country: normalizedText(searchParams.country),
    sort,
  };
}

export function isCatalogPageOutOfRange(
  filters: Pick<CatalogFilters, 'page' | 'sort'>,
  products: { totalPages: number },
): boolean {
  return filters.sort === 'newest' && filters.page > 1 && filters.page > products.totalPages;
}

type CatalogFilterOverrides = Partial<Omit<CatalogFilters, 'pageSize'>>;
type CatalogCollectionHrefOverrides = Partial<Pick<CatalogFilters, 'page' | 'sort'>>;

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

  if (next.country) {
    searchParams.set('country', next.country);
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

export function buildCatalogCollectionHref(
  pathname: string,
  filters: CatalogFilters,
  overrides: CatalogCollectionHrefOverrides = {},
): string {
  const page = overrides.page ?? filters.page;
  const sort = overrides.sort ?? filters.sort;
  const searchParams = new URLSearchParams();

  if (sort !== 'newest') {
    searchParams.set('sort', sort);
  }

  if (page > 1) {
    searchParams.set('page', String(page));
  }

  const query = searchParams.toString();

  return query ? `${pathname}?${query}` : pathname;
}

export type PublicFacetedCatalog = components['schemas']['PublicFacetedCatalogDto'];
export type CatalogListing = PublicFacetedCatalog & { invalidFilters?: boolean };
export type PublicCatalogFacets = components['schemas']['PublicCatalogFacetsDto'];
export type CatalogFacetQuery = components['schemas']['PublicCatalogFacetsQueryDto'];
type AttributeFilter = components['schemas']['PublicCatalogFacetFilterDto'];

export type CatalogFacetScope = Readonly<{ category?: string; brand?: string }>;
export const maxCatalogFacetPage = 1000;
export type CatalogFacetFilters = CatalogFilters &
  Pick<
    CatalogFacetQuery,
    | 'categories'
    | 'brands'
    | 'sizeIds'
    | 'availability'
    | 'minPriceToman'
    | 'maxPriceToman'
    | 'minWeightGrams'
    | 'maxWeightGrams'
    | 'minLengthMm'
    | 'maxLengthMm'
    | 'attributes'
  >;

export const emptyCatalogFacets: PublicCatalogFacets = {
  categories: [],
  brands: [],
  availability: [],
  sizes: [],
  priceToman: null,
  weightGrams: null,
  lengthMm: null,
  attributes: [],
};

export const catalogFacetRanges = [
  {
    facet: 'priceToman',
    min: 'minPriceToman',
    max: 'maxPriceToman',
    floor: 1,
    ceiling: 2147483647,
    decimals: 0,
    label: 'قیمت (تومان)',
  },
  {
    facet: 'weightGrams',
    min: 'minWeightGrams',
    max: 'maxWeightGrams',
    floor: 0.001,
    ceiling: 9999999.999,
    decimals: 3,
    label: 'وزن (گرم)',
  },
  {
    facet: 'lengthMm',
    min: 'minLengthMm',
    max: 'maxLengthMm',
    floor: 1,
    ceiling: 100000,
    decimals: 0,
    label: 'طول (میلی‌متر)',
  },
] as const;

const attributeCode = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const sizeId = /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i;

function boundedText(value: string | undefined, maxLength: number) {
  const text = value?.trim();
  return text && text.length <= maxLength && !text.includes('\0') ? text : undefined;
}

function choices(value: string | string[] | undefined, maxLength: number, pattern?: RegExp) {
  const list = Array.isArray(value) ? value : value === undefined ? [] : [value];
  const valid = list.flatMap((item) => {
    const text = boundedText(item, maxLength);
    return text && (!pattern || pattern.test(text)) ? [text] : [];
  });
  return [...new Set(valid)].slice(0, 16);
}

function readRange(
  searchParams: CatalogSearchParams,
  names: { min: string; max: string },
  { floor, ceiling, decimals }: { floor: number; ceiling: number; decimals: number },
) {
  let invalid = false;
  function read(name: string) {
    const raw = firstValue(searchParams[name])?.trim();
    if (!raw) return undefined;
    const text = raw
      .replace(/[۰-۹٠-٩]/g, (digit) => {
        const code = digit.charCodeAt(0);
        return String(code - (code >= 0x6f0 ? 0x6f0 : 0x660));
      })
      .replace(/[٬,]/g, '')
      .replace('٫', '.');
    const number = Number(text);
    if (
      !/^-?\d+(?:\.\d+)?$/.test(text) ||
      number < floor ||
      number > ceiling ||
      (text.split('.')[1]?.length ?? 0) > decimals
    ) {
      invalid = true;
      return undefined;
    }
    return number;
  }
  const min = read(names.min);
  const max = read(names.max);
  if (min !== undefined && max !== undefined && min > max) {
    return { invalid: true };
  }
  return { min, max, invalid };
}

export function readCatalogFacetFilters(searchParams: CatalogSearchParams): {
  filters: CatalogFacetFilters;
  invalidRange: boolean;
} {
  const base = parseCatalogSearchParams(searchParams);
  const categories = choices(searchParams.category, 180);
  const brands = choices(searchParams.brand, 180);
  const availability = firstValue(searchParams.availability);
  const filters: CatalogFacetFilters = {
    ...base,
    q: boundedText(base.q, 100),
    country: boundedText(base.country, 160),
    category: categories[0],
    brand: brands[0],
    categories,
    brands,
    sizeIds: choices(searchParams.size, 36, sizeId),
    availability:
      availability === 'in-stock' || availability === 'out-of-stock' ? availability : undefined,
  };
  let invalidRange = false;
  for (const range of catalogFacetRanges) {
    const result = readRange(searchParams, range, range);
    filters[range.min] = result.min;
    filters[range.max] = result.max;
    invalidRange ||= result.invalid;
  }

  const codes = new Set(
    Object.keys(searchParams).flatMap((key) => {
      const code = /^(?:attr|min|max):(.+)$/.exec(key)?.[1];
      return code && code.length <= 64 && attributeCode.test(code) ? [code] : [];
    }),
  );
  const attributes: AttributeFilter[] = [];
  for (const code of codes) {
    const values = choices(searchParams[`attr:${code}`], 64, attributeCode);
    if (values.length) {
      attributes.push({ code, values });
    } else {
      const range = readRange(
        searchParams,
        { min: `min:${code}`, max: `max:${code}` },
        {
          floor: -1000000,
          ceiling: 1000000,
          decimals: 3,
        },
      );
      invalidRange ||= range.invalid;
      if (range.min !== undefined || range.max !== undefined) {
        attributes.push({ code, min: range.min, max: range.max });
      }
    }
    if (attributes.length === 8) break;
  }
  filters.attributes = attributes;
  return { filters, invalidRange };
}

export function parseCatalogFacetFilters(params: CatalogSearchParams): CatalogFacetFilters {
  return readCatalogFacetFilters(params).filters;
}

export function catalogSearchParamsFromEntries(
  params: URLSearchParams | FormData,
): CatalogSearchParams {
  return Object.fromEntries(
    [...new Set(params.keys())].map((key) => [
      key,
      params.getAll(key).filter((item): item is string => typeof item === 'string'),
    ]),
  );
}

export function catalogFacetQuery(
  filters: CatalogFacetFilters,
  scope: CatalogFacetScope = {},
): CatalogFacetQuery {
  return {
    page: Math.min(filters.page, maxCatalogFacetPage),
    pageSize: filters.pageSize,
    sort: filters.sort,
    q: filters.q,
    scopeCategory: scope.category,
    scopeBrand: scope.brand,
    scopeCountry: filters.country,
    categories: filters.categories ?? (filters.category ? [filters.category] : []),
    brands: filters.brands ?? (filters.brand ? [filters.brand] : []),
    sizeIds: filters.sizeIds,
    availability: filters.availability,
    minPriceToman: filters.minPriceToman,
    maxPriceToman: filters.maxPriceToman,
    minWeightGrams: filters.minWeightGrams,
    maxWeightGrams: filters.maxWeightGrams,
    minLengthMm: filters.minLengthMm,
    maxLengthMm: filters.maxLengthMm,
    attributes: filters.attributes,
  };
}

export function catalogFacetSearchParams(filters: CatalogFacetFilters): URLSearchParams {
  const query = catalogFacetQuery(filters);
  const params = new URLSearchParams();
  if (query.q) params.set('q', query.q);
  if (query.scopeCountry) params.set('country', query.scopeCountry);
  for (const category of query.categories ?? []) params.append('category', category);
  for (const brand of query.brands ?? []) params.append('brand', brand);
  for (const size of query.sizeIds ?? []) params.append('size', size);
  if (query.availability) params.set('availability', query.availability);
  for (const { min, max } of catalogFacetRanges) {
    if (query[min] !== undefined) params.set(min, String(query[min]));
    if (query[max] !== undefined) params.set(max, String(query[max]));
  }
  for (const attribute of query.attributes ?? []) {
    for (const value of attribute.values ?? []) params.append(`attr:${attribute.code}`, value);
    if (attribute.min !== undefined) params.set(`min:${attribute.code}`, String(attribute.min));
    if (attribute.max !== undefined) params.set(`max:${attribute.code}`, String(attribute.max));
  }
  if (filters.sort !== 'newest') params.set('sort', filters.sort);
  if (filters.page > 1) params.set('page', String(filters.page));
  return params;
}

export function buildFacetedCatalogHref(path: string, filters: CatalogFacetFilters): string {
  const query = catalogFacetSearchParams(filters).toString();
  return query ? `${path}?${query}` : path;
}

export function hasCatalogFacetFilters(filters: CatalogFacetFilters): boolean {
  return catalogFacetSearchParams({ ...filters, page: 1, sort: 'newest' }).size > 0;
}
