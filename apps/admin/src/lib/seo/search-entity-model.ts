import type { components, paths } from '@hamidian/contracts';
import { readSearchOverviewFilters } from './search-overview-model';

export type EntityIdentity = components['schemas']['SearchEntityIdentityDto'];
export type EntityList = components['schemas']['SearchEntityListDto'];
export type EntityDetail = components['schemas']['SearchEntityDetailDto'];
type ListQuery = NonNullable<paths['/api/v1/seo/search-entities']['get']['parameters']['query']>;
type DetailQuery = NonNullable<
  paths['/api/v1/seo/search-entities/{kind}/{id}']['get']['parameters']['query']
>;
type SearchParams = Readonly<Record<string, string | string[] | undefined>>;

export const entityKinds = [
  ['product', 'محصول'],
  ['category', 'دسته‌بندی'],
  ['brand', 'برند'],
  ['article', 'مقاله'],
] as const satisfies readonly [EntityIdentity['kind'], string][];
export const opportunities = [
  ['low-ctr', 'نمایش زیاد، نرخ کلیک کم'],
  ['decline', 'افت کلیک'],
  ['growth', 'رشد سریع'],
] as const satisfies readonly [NonNullable<ListQuery['opportunity']>, string][];
export const entityIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function readEntityFilters(params: SearchParams) {
  const read = (key: string) => {
    const value = params[key];
    return (Array.isArray(value) ? value[0] : value)?.trim() || undefined;
  };
  const numeric = (key: string, fallback: number) => {
    const value = read(key);
    return value && /^\d+(?:\.\d+)?$/.test(value) && Number.isFinite(Number(value))
      ? Number(value)
      : fallback;
  };
  const page = (key: string) => {
    const value = numeric(key, 1);
    return Number.isInteger(value) && value > 0 && value <= 5000 ? value : 1;
  };
  const { startDate, endDate, searchType } = readSearchOverviewFilters(params).base;
  const period = {
    startDate,
    endDate,
    searchType,
    minimumImpressions: numeric('minimumImpressions', 100),
  };
  const list: ListQuery = {
    ...period,
    kind: entityKinds.find(([value]) => value === read('kind'))?.[0] ?? 'product',
    opportunity: opportunities.find(([value]) => value === read('opportunity'))?.[0],
    q: read('q'),
    maximumCtrPercent: numeric('maximumCtrPercent', 2),
    minimumChangePercent: numeric('minimumChangePercent', 20),
    minimumPreviousClicks: numeric('minimumPreviousClicks', 10),
    page: page('page'),
  };
  const detail: DetailQuery = { ...period, urlId: read('urlId'), urlPage: page('urlPage') };
  return { list, detail };
}

function withQuery(path: string, query: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  return `${path}?${params.toString()}`;
}

export function entityListHref(filters: ListQuery, page = 1) {
  return withQuery('/seo/entities', { ...filters, page });
}

export function entityDetailHref(entity: EntityIdentity, filters: DetailQuery) {
  return withQuery(`/seo/entities/${entity.kind}/${entity.id}`, filters);
}

export function entityEditHref(entity: EntityIdentity, permissions: readonly string[]) {
  if (entity.kind === 'article') {
    return permissions.includes('cms.write') ? `/knowledge/${entity.id}/edit` : null;
  }
  if (!permissions.includes('catalog.write')) return null;
  if (entity.kind === 'product') return `/products/${entity.id}/edit`;
  if (!permissions.includes('catalog.read')) return null;
  return withQuery(entity.kind === 'category' ? '/categories' : '/brands', { edit: entity.id });
}
