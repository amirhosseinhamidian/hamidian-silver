import type { components } from '@hamidian/contracts';
import {
  calendarDayMilliseconds,
  calendarParts,
  readCalendarValue,
} from '../presentation/dual-calendar';

export type GrowthDashboard = components['schemas']['GrowthDashboardDto'];
export type GrowthMetrics = components['schemas']['GrowthDashboardMetricsDto'];
export type GrowthDashboardDay = components['schemas']['GrowthDashboardDayDto'];
export type GrowthCosts = components['schemas']['GrowthCostsDto'];
export type GrowthCostInput = components['schemas']['RecordGrowthCostDto'];
type SearchParams = Readonly<Record<string, string | string[] | undefined>>;

const tehranDay = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Tehran',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
export const growthSortOptions = {
  purchases: 'تعداد خرید',
  net: 'وصول خالص',
  spend: 'هزینهٔ ثبت‌شده',
} as const;

export function parseGrowthFilters(values: SearchParams, now = new Date()) {
  const read = (key: string) => {
    const value = values[key];
    return (Array.isArray(value) ? value[0] : value)?.trim() || undefined;
  };
  const page = (key: string) => {
    const value = Number(read(key) ?? 1);
    return Number.isInteger(value) && value >= 1 && value <= 10000 ? value : 1;
  };
  const parts = Object.fromEntries(
    tehranDay.formatToParts(now).map(({ type, value }) => [type, value]),
  );
  const today = `${parts.year}-${parts.month}-${parts.day}`;
  const start = new Date(`${today}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - 29);
  const sort = read('sort');
  return {
    from: read('from') ?? start.toISOString().slice(0, 10),
    to: read('to') ?? today,
    source: read('source'),
    medium: read('medium'),
    campaignId: read('campaignId'),
    category: read('category'),
    product: read('product'),
    brand: read('brand'),
    device: read('device'),
    sort: sort === 'net' || sort === 'spend' ? sort : ('purchases' as const),
    compare: read('compare') === '1',
    page: page('page'),
    costPage: page('costPage'),
  };
}

export type GrowthFilters = ReturnType<typeof parseGrowthFilters>;

export function growthQuery(filters: GrowthFilters, costs = false): URLSearchParams {
  const {
    from,
    to,
    source,
    medium,
    campaignId,
    category,
    product,
    brand,
    device,
    sort,
    page,
    costPage,
  } = filters;
  const query = new URLSearchParams({ from, to });
  for (const [key, value] of Object.entries({ source, medium, campaignId })) {
    if (value) query.set(key, value);
  }
  if (!costs) {
    for (const [key, value] of Object.entries({ category, product, brand, device })) {
      if (value) query.set(key, value);
    }
    if (sort !== 'purchases') query.set('sort', sort);
  }
  query.set('page', String(costs ? costPage : page));
  return query;
}

export function growthDashboardHref(filters: GrowthFilters, hash = '') {
  const query = growthQuery(filters);
  if (filters.compare) query.set('compare', '1');
  if (filters.costPage > 1) query.set('costPage', String(filters.costPage));
  return `/growth?${query}${hash}`;
}

export function previousGrowthPeriod({ from, to }: Pick<GrowthFilters, 'from' | 'to'>) {
  const start = readCalendarValue(from, 'date')?.day ?? NaN;
  const end = readCalendarValue(to, 'date')?.day ?? NaN;
  const length = end - start + calendarDayMilliseconds;
  const day = (time: number) => new Date(time).toISOString().slice(0, 10);
  if (
    !Number.isFinite(length) ||
    length <= 0 ||
    length > 92 * calendarDayMilliseconds ||
    day(start) !== from ||
    day(end) !== to ||
    start - length < Date.UTC(1000, 0, 1)
  )
    return null;
  return { from: day(start - length), to: day(start - calendarDayMilliseconds) };
}

export const growthMetricFields = [
  ['confirmedCustomers', 'خریداران یکتا'],
  ['newCustomers', 'خریداران جدید'],
  ['returningCustomers', 'خریداران بازگشتی'],
  ['submittedOrders', 'سفارش ثبت‌شده'],
  ['confirmedOrders', 'خرید تأییدشده'],
  ['campaignAttributedOrders', 'خرید منتسب به کمپین'],
  ['confirmedSubmissions', 'ثبت‌شده و پرداخت‌شده در بازه'],
  ['conversionPercent', 'نرخ تکمیل پرداخت سفارش'],
  ['averageOrderToman', 'میانگین مبلغ خرید'],
  ['collectedToman', 'وصول قطعی'],
  ['refundedToman', 'بازپرداخت قطعی'],
  ['netCollectedToman', 'وصول خالص'],
  ['orderDiscountToman', 'تخفیف ثبت‌شده در خرید قطعی'],
  ['walletAppliedToman', 'اعتبار مصرف‌شده در خرید قطعی'],
  ['recordedSpendToman', 'هزینهٔ ثبت‌شده'],
  ['recordedSpendPerConfirmedOrderToman', 'هزینهٔ ثبت‌شده به‌ازای خرید'],
  ['measuredVisits', 'نشست سنجیده‌شده'],
  ['itemListViews', 'نمایش فهرست'],
  ['itemSelections', 'انتخاب محصول'],
  ['itemViews', 'مشاهدهٔ محصول'],
  ['cartAdds', 'افزودن به سبد'],
  ['checkouts', 'ورود به تسویه'],
] as const satisfies readonly [keyof GrowthMetrics, string][];

export function growthTrendPoints(
  daily: readonly GrowthDashboardDay[],
  interval: 'day' | 'week' | 'month',
  metric: keyof Omit<GrowthDashboardDay, 'day'>,
) {
  const points: { from: string; to: string; value: number | null }[] = [];
  let previousKey: string | undefined;
  for (const day of daily) {
    const date = new Date(`${day.day}T00:00:00Z`);
    let key = day.day;
    if (interval === 'month') {
      const { year, month } = calendarParts(date.valueOf(), 'persian');
      key = `${year}/${month}`;
    } else if (interval === 'week') {
      key = String(date.valueOf() - ((date.getUTCDay() + 1) % 7) * calendarDayMilliseconds);
    }
    const value = day[metric];
    const last = points.at(-1);
    if (last && key === previousKey) {
      last.to = day.day;
      last.value = last.value === null || value === null ? null : last.value + value;
    } else {
      points.push({ from: day.day, to: day.day, value });
    }
    previousKey = key;
  }
  return points;
}

function csvCell(value: string | number | null) {
  if (value === null) return '';
  if (typeof value === 'number') return String(value);
  const cell = /^[\s\ufeff]*[=+@-]|^[\t\r\n]/.test(value) ? `'${value}` : value;
  return `"${cell.replaceAll('"', '""')}"`;
}

export function growthReportCsv(report: GrowthDashboard) {
  const keys = growthMetricFields.map(([key]) => key);
  const header = ['from', 'to', 'timezone', 'source', 'medium', 'campaign', 'campaignId', ...keys];
  const rows = report.items.map((row) =>
    [
      report.period.from,
      report.period.to,
      report.period.timezone,
      row.source,
      row.medium,
      row.campaign,
      row.campaignId,
      ...keys.map((key) => row[key]),
    ]
      .map(csvCell)
      .join(','),
  );
  return `\ufeff${[header.join(','), ...rows].join('\r\n')}\r\n`;
}
