import type { components } from '@hamidian/contracts';

export type GrowthDashboard = components['schemas']['GrowthDashboardDto'];
export type GrowthMetrics = components['schemas']['GrowthDashboardMetricsDto'];
export type GrowthCosts = components['schemas']['GrowthCostsDto'];
export type GrowthCostInput = components['schemas']['RecordGrowthCostDto'];
type SearchParams = Readonly<Record<string, string | string[] | undefined>>;

const tehranDay = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Tehran',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

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
  return {
    from: read('from') ?? start.toISOString().slice(0, 10),
    to: read('to') ?? today,
    source: read('source'),
    medium: read('medium'),
    campaignId: read('campaignId'),
    category: read('category'),
    device: read('device'),
    page: page('page'),
    costPage: page('costPage'),
  };
}

export type GrowthFilters = ReturnType<typeof parseGrowthFilters>;

export function growthQuery(filters: GrowthFilters, costs = false): URLSearchParams {
  const { from, to, source, medium, campaignId, category, device, page, costPage } = filters;
  const query = new URLSearchParams({ from, to });
  for (const [key, value] of Object.entries({ source, medium, campaignId })) {
    if (value) query.set(key, value);
  }
  if (!costs && category) query.set('category', category);
  if (!costs && device) query.set('device', device);
  query.set('page', String(costs ? costPage : page));
  return query;
}

export const growthMetricFields = [
  ['confirmedCustomers', 'خریداران یکتا'],
  ['submittedOrders', 'سفارش ثبت‌شده'],
  ['confirmedOrders', 'خرید تأییدشده'],
  ['confirmedSubmissions', 'ثبت‌شده و پرداخت‌شده در بازه'],
  ['conversionPercent', 'نرخ تبدیل سفارش'],
  ['averageOrderToman', 'میانگین مبلغ خرید'],
  ['collectedToman', 'وصول قطعی'],
  ['refundedToman', 'بازپرداخت قطعی'],
  ['netCollectedToman', 'وصول خالص'],
  ['recordedSpendToman', 'هزینهٔ ثبت‌شده'],
  ['recordedSpendPerConfirmedOrderToman', 'هزینهٔ ثبت‌شده به‌ازای خرید'],
  ['measuredVisits', 'نشست سنجیده‌شده'],
  ['itemListViews', 'نمایش فهرست'],
  ['itemSelections', 'انتخاب محصول'],
  ['itemViews', 'مشاهدهٔ محصول'],
  ['cartAdds', 'افزودن به سبد'],
  ['checkouts', 'ورود به تسویه'],
] as const satisfies readonly [keyof GrowthMetrics, string][];

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
