import Link from 'next/link';
import { GrowthCostForm } from '@/components/growth/growth-cost-form';
import { GrowthDashboardTrend } from '@/components/growth/growth-dashboard-trend';
import { GrowthManagerialInsights } from '@/components/growth/growth-managerial-insights';
import { CampaignReportCatalogFilters } from '@/components/growth/campaign-report-catalog-filters';
import { CampaignReportPeriod } from '@/components/growth/campaign-report-period';
import { Alert } from '@/components/ui/alert';
import { ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { TableScrollRegion } from '@/components/ui/data-table';
import { Input } from '@/components/ui/form-control';
import { Select } from '@/components/ui/select';
import {
  growthMetricFields,
  growthDashboardHref,
  growthQuery,
  growthSortOptions,
  type GrowthCosts,
  type GrowthDashboard,
  type GrowthFilters,
  type GrowthMetrics,
} from '@/lib/growth/growth-report';
import {
  formatAdminDateTime,
  formatAdminInteger,
  formatAdminToman,
  toPersianDigits,
} from '@/lib/presentation/formatters';

const percent = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 });
const fields = [
  ['source', 'منبع'],
  ['medium', 'کانال'],
  ['campaignId', 'شناسهٔ کمپین یا جشنواره'],
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
const keyMetrics = [
  'collectedToman',
  'netCollectedToman',
  'confirmedOrders',
  'newCustomers',
  'returningCustomers',
  'conversionPercent',
  'averageOrderToman',
  'recordedSpendToman',
] as const satisfies readonly (keyof GrowthMetrics)[];
const metricLabels = Object.fromEntries(growthMetricFields);
const visitStageLabels = [
  ['itemList', 'مشاهدهٔ فهرست محصولات'],
  ['item', 'مشاهدهٔ محصول'],
  ['cart', 'افزودن به سبد'],
  ['checkout', 'شروع تسویه'],
] as const;

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
  const href = (target: number) =>
    growthDashboardHref(
      {
        ...filters,
        page: costHistory ? filters.page : target,
        costPage: costHistory ? target : filters.costPage,
      },
      costHistory ? '#cost-history' : '#growth-groups',
    );
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
  comparison,
  costs,
  status,
  canWriteCosts,
  canPickCatalog,
}: Readonly<{
  filters: GrowthFilters;
  report: GrowthDashboard | null;
  comparison: GrowthDashboard | null;
  costs: GrowthCosts | null;
  status: number;
  canWriteCosts: boolean;
  canPickCatalog: boolean;
}>) {
  const measuredStages = report?.visitStages;
  const measuredVisits = report?.totals.measuredVisits;
  return (
    <main className="admin-container space-y-6 py-6 sm:py-8 lg:py-10">
      <h1 className="text-2xl font-black">داشبورد رشد</h1>
      <Card
        title="بازه و فیلترها"
        description="روزهای میلادی بر اساس ساعت تهران محاسبه می‌شوند. هر گزارش تا ۹۲ روز را پوشش می‌دهد."
      >
        <CampaignReportPeriod
          key={growthDashboardHref(filters)}
          path="/growth"
          from={filters.from}
          to={filters.to}
        >
          <div className="grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {fields.map(([name, label]) => (
              <label className="text-sm" key={name}>
                {label}
                <Input name={name} dir="ltr" defaultValue={filters[name]} maxLength={180} />
              </label>
            ))}
            <label className="text-sm">
              دستگاه
              <Select
                name="device"
                defaultValue={filters.device ?? ''}
                className="mt-1 h-10 w-full rounded-md border border-[var(--admin-color-border)] bg-[var(--admin-color-surface)] px-3"
                aria-label="دستگاه"
                options={[
                  { value: '', label: 'همه' },
                  { value: 'desktop', label: 'رایانه' },
                  { value: 'mobile', label: 'موبایل' },
                  { value: 'tablet', label: 'تبلت' },
                  { value: 'unknown', label: 'ثبت نشده' },
                ]}
              />
            </label>
            <label className="text-sm">
              بخش پایانی نشانی برند
              <Input
                name="brand"
                defaultValue={filters.brand}
                pattern="[\p{L}\p{N}_\-]+"
                maxLength={180}
              />
            </label>
            <label className="text-sm">
              مرتب‌سازی جدول کانال‌ها و کمپین‌ها
              <Select
                name="sort"
                defaultValue={filters.sort}
                className="mt-1 min-h-10 w-full rounded-md border border-[var(--admin-color-border)] bg-[var(--admin-color-surface)] px-3"
                aria-label="مرتب‌سازی جدول کانال‌ها و کمپین‌ها"
                options={Object.entries(growthSortOptions).map(([value, label]) => ({
                  value,
                  label,
                }))}
              />
            </label>
          </div>
          <CampaignReportCatalogFilters
            canPickCatalog={canPickCatalog}
            manualLabel="ورود دستی نشانی کاتالوگ"
            filters={[
              { name: 'category', value: filters.category, pattern: '[\\p{L}\\p{N}_\\-]+' },
              { name: 'product', value: filters.product, pattern: '[\\p{L}\\p{N}_\\-]+' },
            ]}
          />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="compare" value="1" defaultChecked={filters.compare} />
            مقایسه با بازهٔ قبلی هم‌اندازه
          </label>
        </CampaignReportPeriod>
      </Card>

      {report ? (
        <>
          <GrowthManagerialInsights report={report} comparison={comparison} filters={filters} />
          <Card
            title="شاخص‌های بازه"
            description={`زمان گزارش ${formatAdminDateTime(report.generatedAt)} · روزهای تهران · تومان`}
          >
            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {keyMetrics.map((key) => (
                <div className="rounded-md bg-[var(--admin-color-surface-subtle)] p-3" key={key}>
                  <dt className="text-xs text-[var(--admin-color-muted)]">{metricLabels[key]}</dt>
                  <dd className="mt-1 text-base font-bold">{metric(key, report.totals[key])}</dd>
                </div>
              ))}
            </dl>
            <details className="mt-4 space-y-3 text-sm">
              <summary className="cursor-pointer underline">شاخص‌های بیشتر و تعریف محاسبه</summary>
              <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
                {growthMetricFields
                  .filter(([key]) => !keyMetrics.some((included) => included === key))
                  .map(([key, label]) => (
                    <div key={key} className="border-b border-[var(--admin-color-border)] py-1">
                      <dt className="text-xs text-[var(--admin-color-muted)]">{label}</dt>
                      <dd>{metric(key, report.totals[key])}</dd>
                    </div>
                  ))}
                <div className="border-b border-[var(--admin-color-border)] py-1">
                  <dt className="text-xs text-[var(--admin-color-muted)]">
                    سهم خریدهای منتسب به کمپین
                  </dt>
                  <dd>
                    {report.totals.confirmedOrders === 0
                      ? 'خریدی ثبت نشده'
                      : `${percent.format((100 * report.totals.campaignAttributedOrders) / report.totals.confirmedOrders)}٪`}
                  </dd>
                </div>
              </dl>
              <ul className="space-y-2 text-xs leading-6 text-[var(--admin-color-muted)]">
                <li>
                  نرخ تکمیل پرداخت، سهم سفارش‌های ثبت‌شده در همین بازه است که تا پایان آن قطعی
                  شده‌اند. وصول خالص، وصول قطعی منهای بازپرداخت‌های قطعی همان روزهای گزارش است.
                </li>
                <li>
                  خریدار جدید اولین خرید قطعی تاریخچه را در همین برش انجام داده است. خریدار بازگشتی
                  پیش از شروع بازه خرید قطعی داشته است. در گزارش فیلترشده ممکن است اولین خرید خریدار
                  در همین بازه و در برش دیگری باشد.
                </li>
                <li>
                  مصرف اعتبار از Snapshot خرید قطعی و پیش از برگشت اعتبار خوانده می‌شود. در صورت
                  نبود Snapshot برای بخشی از خریدها، مجموع این شاخص ناموجود است. نرخ خرید مجدد به
                  گروه مشتریان با مهلت پیگیری کافی نیاز دارد.
                </li>
                <li>
                  فیلتر کاتالوگ سفارش کامل را با اطلاعات فعلی یکی از اقلامش انتخاب می‌کند. هزینهٔ
                  ثبت‌شده در برش محصول، دسته، برند و دستگاه تخصیص داده نمی‌شود.
                </li>
              </ul>
              <Link className="underline" href="/reward-policies/referral-grants">
                گزارش مستقل اعتبار معرفی دوستان
              </Link>
            </details>
          </Card>
          {filters.compare && (
            <Card id="growth-comparison" className="scroll-mt-24" title="مقایسه با بازهٔ قبلی">
              {comparison ? (
                <TableScrollRegion label="مقایسهٔ دو بازه">
                  <table className="w-full min-w-[29rem] text-sm">
                    <thead>
                      <tr>
                        <th scope="col" className={cell}>
                          شاخص
                        </th>
                        <th scope="col" className={cell}>
                          بازهٔ فعلی
                        </th>
                        <th scope="col" className={cell}>
                          <Link
                            className="underline"
                            href={growthDashboardHref({
                              ...filters,
                              from: comparison.period.from,
                              to: comparison.period.to,
                              compare: false,
                              page: 1,
                              costPage: 1,
                            })}
                          >
                            {toPersianDigits(comparison.period.from)} تا{' '}
                            {toPersianDigits(comparison.period.to)}
                          </Link>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {keyMetrics.map((key) => (
                        <tr key={key}>
                          <th scope="row" className={cell}>
                            {metricLabels[key]}
                          </th>
                          <td className={cell}>{metric(key, report.totals[key])}</td>
                          <td className={cell}>{metric(key, comparison.totals[key])}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableScrollRegion>
              ) : (
                <p role="status" className="text-sm">
                  دریافت داده‌های بازهٔ قبلی ممکن نشد.
                </p>
              )}
            </Card>
          )}
          <Card
            title="روند رشد"
            description="هفته از شنبه شروع می‌شود و ماه‌ها بر اساس تقویم شمسی‌اند. ابتدا و انتهای هر گروه به بازهٔ انتخاب‌شده محدود است."
          >
            <GrowthDashboardTrend daily={report.daily} />
          </Card>
          <Card
            title="مراحل مشاهده‌شده در مرورگر"
            description="هر ردیف تعداد نشست‌های یکتا برای همان مرحله را نشان می‌دهد. دادهٔ ثبت سفارش و خرید در شاخص‌های سفارش گزارش می‌شود."
          >
            {measuredStages && measuredVisits ? (
              <>
                <p className="mb-3 text-sm">{formatAdminInteger(measuredVisits)} نشست سنجیده‌شده</p>
                <dl className="space-y-3 text-sm">
                  {visitStageLabels.map(([key, label]) => (
                    <div key={key} className="grid grid-cols-[1fr_auto] items-center gap-2">
                      <dt>{label}</dt>
                      <dd>{formatAdminInteger(measuredStages[key])}</dd>
                      <dd className="col-span-2" aria-hidden="true">
                        <meter
                          className="h-2 w-full"
                          max={measuredVisits}
                          value={measuredStages[key]}
                        />
                      </dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-3 text-xs leading-6 text-[var(--admin-color-muted)]">
                  ثبت رویداد اختیاری است و یک نشست می‌تواند در چند ردیف شمرده شود. اتصال نشست به
                  سفارش برای محاسبهٔ تبدیل خرید موجود نیست.
                </p>
              </>
            ) : (
              <p className="text-sm">برای این فیلتر رویداد مرورگر ثبت نشده است.</p>
            )}
          </Card>
          <Card
            id="growth-groups"
            className="scroll-mt-24"
            title="کانال‌ها و کمپین‌ها"
            description="هر ردیف یک ترکیب منبع، کانال و کمپین است. پیوندها همین بازه و فیلترهای فعال را در ریزگزارش نگه می‌دارند."
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
              <TableScrollRegion label="جدول کانال‌ها و کمپین‌ها">
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
                          {row.source || row.medium ? (
                            <Link
                              className="underline"
                              href={growthDashboardHref(
                                {
                                  ...filters,
                                  source: row.source ?? filters.source,
                                  medium: row.medium ?? filters.medium,
                                  page: 1,
                                  costPage: 1,
                                },
                                '#growth-groups',
                              )}
                            >
                              <bdi>{[row.source, row.medium].filter(Boolean).join(' / ')}</bdi>
                            </Link>
                          ) : (
                            'بدون انتساب'
                          )}
                        </td>
                        <td className={cell}>
                          {row.campaignId ? (
                            <Link
                              className="underline"
                              href={growthDashboardHref(
                                {
                                  ...filters,
                                  campaignId: row.campaignId,
                                  source: row.source ?? filters.source,
                                  medium: row.medium ?? filters.medium,
                                  page: 1,
                                  costPage: 1,
                                },
                                '#growth-groups',
                              )}
                            >
                              <bdi>{row.campaign ?? row.campaignId}</bdi>
                            </Link>
                          ) : (
                            <bdi>{row.campaign ?? '—'}</bdi>
                          )}
                          {row.campaignId ? (
                            <Link
                              className="mt-1 block text-xs underline text-[var(--admin-color-muted)]"
                              href={`/growth/campaigns/${encodeURIComponent(row.campaignId)}?${new URLSearchParams({ from: filters.from, to: filters.to })}`}
                            >
                              گزارش کل کمپین
                            </Link>
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
              </TableScrollRegion>
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
        className="scroll-mt-24"
        title="تاریخچهٔ هزینه‌های کمپین"
        description="روز و مبلغ هر ثبت با منبع و کانال کمپین نشان داده می‌شود."
      >
        {(filters.category || filters.brand || filters.product || filters.device) && (
          <p className="mb-3 text-sm text-[var(--admin-color-muted)]">
            تاریخچهٔ هزینه فقط با بازه، منبع، کانال و کمپین فیلتر می‌شود.
          </p>
        )}
        {costs?.items.length ? (
          <TableScrollRegion label="جدول تاریخچهٔ هزینه‌های کمپین">
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
          </TableScrollRegion>
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
