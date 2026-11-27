import type { paths } from '@hamidian/contracts';
import type { StorefrontSearchParams } from '@/lib/seo/metadata';

type LandingOperation = paths['/api/v1/campaigns/public/landing/{slug}']['get'];
export type CampaignFilters = Omit<
  NonNullable<LandingOperation['parameters']['query']>,
  'page' | 'productsOnly'
>;

export const campaignSorts = [
  ['newest', 'جدیدترین'],
  ['price-asc', 'کمترین قیمت'],
  ['price-desc', 'بیشترین قیمت'],
  ['name-asc', 'نام محصول'],
] as const;

function slug(value: StorefrontSearchParams[string]) {
  return typeof value === 'string' &&
    value.length <= 180 &&
    /^[\p{L}\p{N}][\p{L}\p{N}-]*$/u.test(value)
    ? value
    : undefined;
}

function price(value: StorefrontSearchParams[string]) {
  if (typeof value !== 'string' || !/^[1-9]\d{0,9}$/.test(value)) return undefined;
  const amount = Number(value);
  return amount <= 2_147_483_647 ? amount : undefined;
}

export function campaignFilters(input: StorefrontSearchParams): CampaignFilters {
  return {
    scopeCategory: slug(input.category),
    scopeBrand: slug(input.brand),
    minPriceToman: price(input.minPriceToman),
    maxPriceToman: price(input.maxPriceToman),
    sort: campaignSorts.find(([value]) => value === input.sort)?.[0],
  };
}

export function hasCampaignFilters(filters: CampaignFilters) {
  return Object.values(filters).some((value) => value !== undefined);
}

export function campaignFilterParams(filters: CampaignFilters) {
  const params = new URLSearchParams();
  if (filters.scopeCategory) params.set('category', filters.scopeCategory);
  if (filters.scopeBrand) params.set('brand', filters.scopeBrand);
  if (filters.minPriceToman !== undefined)
    params.set('minPriceToman', String(filters.minPriceToman));
  if (filters.maxPriceToman !== undefined)
    params.set('maxPriceToman', String(filters.maxPriceToman));
  if (filters.sort) params.set('sort', filters.sort);
  return params;
}

export function campaignPageHref(pathname: string, filters: CampaignFilters, page = 1) {
  const params = campaignFilterParams(filters);
  if (page > 1) params.set('page', String(page));
  return params.size ? `${pathname}?${params}` : pathname;
}
