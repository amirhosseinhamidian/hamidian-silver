import Link from 'next/link';
import { GrowthCostForm } from '@/components/growth/growth-cost-form';
import { Alert } from '@/components/ui/alert';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/form-control';
import {
  growthMetricFields,
  growthQuery,
  type GrowthCosts,
  type GrowthDashboard,
  type GrowthFilters,
  type GrowthMetrics,
} from '@/lib/growth/growth-report';
import {
  formatAdminDateTime,
  formatAdminInteger,
  formatAdminToman,
} from '@/lib/presentation/formatters';

const percent = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 });
const fields = [
  ['from', 'از روز', 'date'],
  ['to', 'تا روز', 'date'],
  ['source', 'منبع', 'text'],
  ['medium', 'کانال', 'text'],
  ['campaignId', 'شناسهٔ کمپین', 'text'],
  ['category', 'اسلاگ دسته', 'text'],
] as const;
const columns = growthMetricFields.filter(([key]) =>
  (
    [
      'confirmedOrders',
      'conversionPercent',
      'netCollectedToman',
      'recordedSpendToman',
      'measuredVisits',
    ] as const
  ).some((column) => column === key),
);
const cell = 'border-b border-[var(--admin-color-border)] px-3 py-2.5 text-start';

function metric(key: keyof GrowthMetrics, value: number | null) {
  if (value === null) return 'داده موجود نیست';
  if (key === 'conversionPercent') return `${percent.format(value)}٪`;
  return key.endsWith('Toman') ? formatAdminToman(value) : formatAdminInteger(value);
}

function ReportPagination({
  filters,
  page,
  limit,
  total,
  costHistory = false,
}: Readonly<{
  filters: GrowthFilters;
  page: number;
  limit: number;
  total: number;
  costHistory?: boolean;
}>) {
  const last = Math.max(1, Math.ceil(total / limit));
  if (page === 1 && last === 1) return null;
  const href = (target: number) => {
    const query = growthQuery(filters);
    query.set('page', String(costHistory ? filters.page : target));
    query.set('costPage', String(costHistory ? target : filters.costPage));
    return `/growth?${query.toString()}${costHistory ? '#cost-history' : '#growth-groups'}`;
  };
  return (
    <nav
      aria-label={costHistory ? 'صفحه‌بندی هزینه‌ها' : 'صفحه‌بندی گزارش رشد'}
      className="mt-4 flex flex-wrap items-center gap-3"
    >
      {page > 1 ? (
        <ButtonLink variant="outline" href={href(page - 1)}>
          قبلی
        </ButtonLink>
      ) : null}
      <span className="text-sm">
        صفحهٔ {formatAdminInteger(page)} از {formatAdminInteger(last)}
      </span>
      {page < last && page < 10000 ? (
        <ButtonLink variant="outline" href={href(page + 1)}>
          بعدی
        </ButtonLink>
      ) : null}
    </nav>
  );
}

export function GrowthDashboardView({
  filters,
  report,
  costs,
  status,
  canWriteCosts,
}: Readonly<{
  filters: GrowthFilters;
  report: GrowthDashboard | null;
  costs: GrowthCosts | null;
  status: number;
  canWriteCosts: boolean;
}>) {
  return (
    <main className="admin-container space-y-6 py-6 sm:py-8 lg:py-10">
      <h1 className="text-2xl font-black">داشبورد رشد</h1>
      <Card
        title="بازه و فیلترها"
        description="روزهای میلادی بر اساس ساعت تهران محاسبه می‌شوند. هر گزارش تا ۹۲ روز را پوشش می‌دهد."
      >
        <form
          action="/growth"
          method="get"
          className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4"
        >
          {fields.map(([name, label, type]) => (
            <label className="text-sm" key={name}>
              {label}
              <Input
                name={name}
                type={type}
                dir="ltr"
                defaultValue={filters[name]}
                maxLength={type === 'text' ? 180 : undefined}
                required={type === 'date'}
              />
            </label>
          ))}
          <label className="text-sm">
            دستگاه
            <select
              name="device"
              defaultValue={filters.device ?? ''}
              className="mt-1 block h-10 w-full rounded-md border border-[var(--admin-color-border)] bg-[var(--admin-color-surface)] px-3"
            >
              <option value="">همه</option>
              <option value="desktop">رایانه</option>
              <option value="mobile">موبایل</option>
              <option value="tablet">تبلت</option>
              <option value="unknown">ثبت نشده</option>
            </select>
          </label>
          <Button type="submit">نمایش گزارش</Button>
        </form>
      </Card>

      {report ? (
        <>
          <Card title="شاخص‌های بازه">
            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {growthMetricFields.map(([key, label]) => (
                <div className="rounded-md bg-[var(--admin-color-surface-subtle)] p-3" key={key}>
                  <dt className="text-xs text-[var(--admin-color-muted)]">{label}</dt>
                  <dd className="mt-1 text-base font-bold">{metric(key, report.totals[key])}</dd>
                </div>
              ))}
            </dl>
            <ul className="mt-4 space-y-2 text-xs leading-6 text-[var(--admin-color-muted)]">
              <li>
                خرید، وصول و بازپرداخت از پرداخت و سفارش قطعی می‌آیند. نرخ تبدیل، سهم سفارش‌های
                ثبت‌شده در بازه است که تا پایان همان بازه پرداخت شده‌اند.
              </li>
              <li>
                نشست و قیف از رویدادهای اختیاری مرورگر می‌آیند و فقط نشست‌هایی را می‌سنجند که رویداد
                ثبت‌شده دارند. دادهٔ Google Analytics در این گزارش وارد نشده است.
              </li>
              <li>
                فیلتر دسته، سفارش کامل را با عضویت فعلی یکی از کالاهایش می‌سنجد. هزینهٔ دستی در سطح
                کمپین ثبت می‌شود و در برش دسته یا دستگاه تخصیص داده نمی‌شود.
              </li>
            </ul>
          </Card>
          <Card
            id="growth-groups"
            title="کانال‌ها و کمپین‌ها"
            action={
              report.items.length ? (
                <a
                  className="text-sm underline"
                  href={`/api/growth/export?${growthQuery(filters).toString()}`}
                >
                  CSV این صفحه
                </a>
              ) : undefined
            }
          >
            {report.items.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[48rem] text-sm">
                  <thead>
                    <tr>
                      <th scope="col" className={cell}>
                        منبع و کانال
                      </th>
                      <th scope="col" className={cell}>
                        کمپین
                      </th>
                      {columns.map(([key, label]) => (
                        <th scope="col" className={cell} key={key}>
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.items.map((row) => (
                      <tr
                        key={JSON.stringify([row.source, row.medium, row.campaignId, row.campaign])}
                      >
                        <td className={cell}>
                          <bdi>
                            {[row.source, row.medium].filter(Boolean).join(' / ') || 'بدون انتساب'}
                          </bdi>
                        </td>
                        <td className={cell}>
                          {row.campaignId ? (
                            <Link
                              className="underline"
                              href={`/growth/campaigns/${encodeURIComponent(row.campaignId)}?${new URLSearchParams({ from: filters.from, to: filters.to })}`}
                            >
                              <bdi>{row.campaign ?? row.campaignId}</bdi>
                            </Link>
                          ) : (
                            <bdi>{row.campaign ?? '—'}</bdi>
                          )}
                          {row.campaignId ? (
                            <bdi className="block text-xs text-[var(--admin-color-muted)]">
                              {row.campaignId}
                            </bdi>
                          ) : null}
                        </td>
                        {columns.map(([key]) => (
                          <td className={cell} key={key}>
                            {metric(key, row[key])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm">
                در این صفحه و بازه داده‌ای برای فیلترهای انتخاب‌شده وجود ندارد.
              </p>
            )}
            <ReportPagination filters={filters} {...report} />
          </Card>
        </>
      ) : (
        <Alert tone="danger">
          {status === 400 ? 'بازه یا یکی از فیلترها معتبر نیست.' : 'دریافت گزارش رشد ممکن نشد.'}
        </Alert>
      )}

      <Card
        id="cost-history"
        title="تاریخچهٔ هزینه‌های کمپین"
        description="روز و مبلغ هر ثبت با منبع و کانال کمپین نشان داده می‌شود."
      >
        {costs?.items.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[42rem] text-sm">
              <thead>
                <tr>
                  {['روز هزینه', 'کمپین', 'منبع و کانال', 'مبلغ', 'زمان ثبت', 'یادداشت'].map(
                    (name) => (
                      <th scope="col" key={name} className={cell}>
                        {name}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {costs.items.map((row) => (
                  <tr key={row.id}>
                    <td className={cell}>
                      <bdi>{row.day}</bdi>
                    </td>
                    <td className={cell}>
                      <bdi>{row.campaign}</bdi>
                    </td>
                    <td className={cell}>
                      <bdi>
                        {row.source} / {row.medium}
                      </bdi>
                    </td>
                    <td className={cell}>{formatAdminToman(row.amountToman)}</td>
                    <td className={cell}>{formatAdminDateTime(row.recordedAt)}</td>
                    <td className={cell}>{row.note ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm">
            {costs ? 'هزینه‌ای در این صفحه ثبت نشده است.' : 'دریافت تاریخچهٔ هزینه ممکن نشد.'}
          </p>
        )}
        {costs ? <ReportPagination filters={filters} {...costs} costHistory /> : null}
        {canWriteCosts ? (
          <details className="mt-4">
            <summary className="cursor-pointer font-semibold">ثبت هزینه یا اصلاحیه</summary>
            <p className="mt-3 text-xs">
              شناسهٔ کمپین را از لینک ساخته‌شده در{' '}
              <Link className="underline" href="/settings">
                تنظیمات سایت
              </Link>{' '}
              بردارید.
            </p>
            <GrowthCostForm
              key={JSON.stringify([filters.to, filters.campaignId, filters.source, filters.medium])}
              defaults={{
                day: filters.to,
                campaignId: filters.campaignId,
                source: filters.source,
                medium: filters.medium,
              }}
            />
          </details>
        ) : null}
      </Card>
    </main>
  );
}
