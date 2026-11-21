import type { components, paths } from '@hamidian/contracts';

export type SearchOverview = components['schemas']['SearchOverviewDto'];
export type SearchOverviewRows = components['schemas']['SearchOverviewRowsDto'];
export type OverviewMetrics = components['schemas']['SearchOverviewMetricsDto'];
export type OverviewPeriod = components['schemas']['SearchOverviewPeriodDto'];

type OverviewQuery = NonNullable<
  paths['/api/v1/seo/search-overview']['get']['parameters']['query']
>;
type RowsQuery = NonNullable<
  paths['/api/v1/seo/search-overview/rows']['get']['parameters']['query']
>;
type SearchParams = Readonly<Record<string, string | string[] | undefined>>;

export const searchTypes = [
  ['web', 'وب'],
  ['image', 'تصویر'],
  ['video', 'ویدئو'],
  ['news', 'اخبار'],
] as const satisfies readonly [NonNullable<OverviewQuery['searchType']>, string][];
const deviceSegments = ['DESKTOP', 'MOBILE', 'TABLET'] as const;
const brandSegments = ['BRANDED', 'NON_BRANDED'] as const;
export const searchSegments = [
  ['', 'همهٔ جست‌وجوها'],
  ['DESKTOP', 'رایانه'],
  ['MOBILE', 'موبایل'],
  ['TABLET', 'تبلت'],
  ['BRANDED', 'جست‌وجوی برند در وب'],
  ['NON_BRANDED', 'جست‌وجوی غیربرند در وب'],
] as const;
export const searchSorts = [
  ['clicks', 'کلیک'],
  ['impressions', 'نمایش'],
  ['ctr', 'نرخ کلیک'],
  ['position', 'رتبهٔ متوسط'],
  ['label', 'نام'],
] as const satisfies readonly [NonNullable<RowsQuery['sort']>, string][];
export const overviewMetrics = [
  ['clicks', 'کلیک'],
  ['impressions', 'نمایش'],
  ['ctr', 'نرخ کلیک'],
  ['averagePosition', 'رتبهٔ متوسط'],
] as const satisfies readonly [keyof OverviewMetrics, string][];

const pacific = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Los_Angeles',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function readSearchOverviewFilters(values: SearchParams, now = new Date()) {
  const read = (key: string) => {
    const value = values[key];
    return (Array.isArray(value) ? value[0] : value)?.trim() ?? '';
  };
  const parts = Object.fromEntries(
    pacific.formatToParts(now).map(({ type, value }) => [type, value]),
  );
  const today = new Date(`${parts.year}-${parts.month}-${parts.day}T00:00:00Z`).getTime();
  const iso = (daysAgo: number) =>
    new Date(today - daysAgo * 86_400_000).toISOString().slice(0, 10);
  const searchType = searchTypes.find(([key]) => key === read('searchType'))?.[0] ?? 'web';
  const segment = read('segment');
  const device = deviceSegments.find((option) => option === segment);
  const brand =
    searchType === 'web' ? brandSegments.find((option) => option === segment) : undefined;
  const sort = searchSorts.find(([key]) => key === read('sort'))?.[0] ?? 'clicks';
  const requestedPage = Number(read('page'));
  const page =
    Number.isInteger(requestedPage) && requestedPage > 0 && requestedPage <= 5000
      ? requestedPage
      : 1;
  const base: OverviewQuery = {
    startDate: read('startDate') || iso(30),
    endDate: read('endDate') || iso(3),
    searchType,
    device,
    brand,
  };
  const rows: RowsQuery = {
    ...base,
    kind: read('kind') === 'page' ? 'page' : 'query',
    q: read('q') || undefined,
    sort,
    direction: read('direction') === 'asc' ? 'asc' : 'desc',
    page,
  };
  return { base, rows, segment: device ?? brand ?? '' };
}

export type OverviewFilters = ReturnType<typeof readSearchOverviewFilters>;

export function overviewHref(filters: OverviewFilters, overrides: Partial<RowsQuery> = {}) {
  const { startDate, endDate, searchType, kind, q, sort, direction, page } = {
    ...filters.rows,
    ...overrides,
  };
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries({
    startDate,
    endDate,
    searchType,
    segment: filters.segment,
    kind,
    q,
    sort,
    direction,
    page: page && page > 1 ? String(page) : undefined,
  })) {
    if (value) query.set(key, value);
  }
  return `/seo?${query.toString()}#seo-tables`;
}

const number = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 2 });
const percentage = new Intl.NumberFormat('fa-IR', { style: 'percent', maximumFractionDigits: 2 });
const signed = new Intl.NumberFormat('fa-IR', {
  maximumFractionDigits: 2,
  signDisplay: 'exceptZero',
});

export function displaySearchMetric(metric: keyof OverviewMetrics, value?: number | null) {
  if (value == null) return '—';
  return metric === 'ctr' ? percentage.format(value) : number.format(value);
}

export function displaySearchChange(metric: keyof OverviewMetrics, value: number) {
  return metric === 'ctr' ? `${signed.format(value * 100)} واحد درصد` : signed.format(value);
}
