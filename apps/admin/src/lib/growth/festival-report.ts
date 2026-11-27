import type { components, paths } from '@hamidian/contracts';
import { campaignOrderLabels } from '@/lib/campaigns/campaign-model';
import { parseGrowthFilters } from './growth-report';

export type FestivalReport = components['schemas']['FestivalAnalyticsDto'];
type Query = NonNullable<paths['/api/v1/campaigns/{id}/analytics']['get']['parameters']['query']>;
export type FestivalReportFilters = Required<
  Pick<Query, 'from' | 'to' | 'page' | 'section' | 'sort'>
> &
  Pick<Query, 'product' | 'category' | 'orderState'>;

export const festivalSectionLabels: Record<FestivalReportFilters['section'], string> = {
  products: 'محصولات',
  categories: 'دسته‌بندی‌ها',
  brands: 'برندها',
  offers: 'پیشنهادهای فروش',
  sources: 'منابع ورودی',
  orders: 'سفارش‌ها',
  quotas: 'سهمیه‌ها',
};

export function parseFestivalFilters(
  values: Readonly<Record<string, string | string[] | undefined>>,
): FestivalReportFilters {
  const { from, to, page } = parseGrowthFilters(values);
  const read = (key: string) => {
    const value = values[key];
    return typeof value === 'string' ? value.trim() : '';
  };
  const slug = (key: string) => {
    const value = read(key);
    return value && value.length <= 220 && !value.includes('\0') ? value : undefined;
  };
  const section = read('section');
  const orderState = read('orderState');
  return {
    from,
    to,
    page: Math.min(page, 1000),
    product: slug('product'),
    category: slug('category'),
    section: Object.hasOwn(festivalSectionLabels, section)
      ? (section as FestivalReportFilters['section'])
      : 'products',
    sort: read('sort') === 'asc' ? 'asc' : 'desc',
    orderState: Object.hasOwn(campaignOrderLabels, orderState)
      ? (orderState as keyof typeof campaignOrderLabels)
      : undefined,
  };
}

export function festivalReportHref(path: string, filters: FestivalReportFilters) {
  const query = new URLSearchParams({ from: filters.from, to: filters.to });
  for (const [key, value] of Object.entries({
    product: filters.product,
    category: filters.category,
    orderState: filters.orderState,
    section: filters.section === 'products' ? undefined : filters.section,
    sort: filters.sort === 'desc' ? undefined : filters.sort,
    page: filters.page === 1 ? undefined : String(filters.page),
  })) {
    if (value) query.set(key, value);
  }
  return `${path}?${query}`;
}
