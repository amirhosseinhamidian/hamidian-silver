import Link from 'next/link';
import type { ReactNode } from 'react';

import { CampaignReportPeriod } from '@/components/growth/campaign-report-period';
import { Alert } from '@/components/ui/alert';
import { ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { TableScrollRegion } from '@/components/ui/data-table';
import { DonutChart } from '@/components/ui/donut-chart';
import { CampaignReportCatalogFilters } from '@/components/growth/campaign-report-catalog-filters';
import { campaignOrderLabels } from '@/lib/campaigns/campaign-model';
import {
  festivalReportHref,
  festivalSectionLabels,
  type FestivalReport,
  type FestivalReportFilters,
} from '@/lib/growth/festival-report';
import {
  formatAdminDateTime,
  formatAdminInteger as integer,
  formatAdminToman as money,
} from '@/lib/presentation/formatters';

const cell = 'px-3 py-2.5 text-start align-top';
const muted = 'text-sm text-[var(--admin-color-muted)]';
const unknown = 'داده در دسترس نیست';
const percent = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 });
const dayLabel = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
  month: 'short',
  day: 'numeric',
  timeZone: 'Asia/Tehran',
});
const offerLabels: Record<string, string> = {
  PERCENT: 'تخفیف درصدی',
  FIXED: 'تخفیف مبلغ ثابت',
  THRESHOLD: 'تخفیف حداقل خرید',
  BUNDLE: 'بستهٔ ترکیبی',
  FREE_SHIPPING: 'ارسال رایگان',
};

function shortDay(day: string) {
  return dayLabel.format(new Date(`${day}T00:00:00Z`));
}

function Stats({ items }: { items: readonly (readonly [string, string])[] }) {
  return (
    <dl className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {items.map(([label, value]) => (
        <div key={label} className="rounded-md bg-[var(--admin-color-surface-subtle)] p-3">
          <dt className={muted}>{label}</dt>
          <dd className="mt-1 font-bold tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Table({
  label,
  headers,
  children,
}: {
  label: string;
  headers: readonly string[];
  children: ReactNode;
}) {
  return (
    <TableScrollRegion label={label}>
      <table className="w-full min-w-[31rem] text-sm" aria-label={label}>
        <thead className="bg-[var(--admin-color-surface-subtle)]">
          <tr>
            {headers.map((header) => (
              <th scope="col" key={header} className={cell}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--admin-color-border)]">{children}</tbody>
      </table>
    </TableScrollRegion>
  );
}

function DailyTrends({ daily }: { daily: FestivalReport['daily'] }) {
  const charts = [
    {
      key: 'collectedToman',
      title: 'روند روزانهٔ وصول قطعی',
      format: money,
      color: 'bg-[var(--admin-color-primary)]',
    },
    {
      key: 'confirmedOrders',
      title: 'روند روزانهٔ خریدهای تأییدشده',
      format: integer,
      color: 'bg-[var(--admin-color-info)]',
    },
  ] as const;
  return (
    <Card title="روند فروش و سفارش">
      <div className="grid gap-4 lg:grid-cols-2">
        {charts.map(({ key, title, format, color }) => {
          const maximum = Math.max(1, ...daily.map((point) => point[key]));
          return (
            <figure
              key={key}
              className="min-w-0 rounded-md bg-[var(--admin-color-surface-subtle)] p-3"
            >
              <figcaption className="mb-2 text-sm font-semibold">{title}</figcaption>
              <div className="overflow-x-auto">
                <div
                  aria-hidden="true"
                  className="flex h-24 items-end gap-px border-b border-[var(--admin-color-border)]"
                >
                  {daily.map((point) => (
                    <span
                      key={point.day}
                      title={`${shortDay(point.day)} · ${format(point[key])}`}
                      className={`min-w-1 flex-1 rounded-t-sm ${color}`}
                      style={{
                        height: `${point[key] ? Math.max(2, (point[key] / maximum) * 100) : 0}%`,
                      }}
                    />
                  ))}
                </div>
              </div>
              <div aria-hidden="true" className="mt-1 flex justify-between text-xs">
                <span>{shortDay(daily[0].day)}</span>
                <span>{shortDay(daily[daily.length - 1].day)}</span>
              </div>
            </figure>
          );
        })}
      </div>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer font-semibold">ارقام هر روز</summary>
        <div className="mt-2 max-h-80 overflow-auto">
          <Table label="فروش روزانه" headers={['روز', 'خرید تأییدشده', 'وصول قطعی']}>
            {daily.map((point) => (
              <tr key={point.day}>
                <th scope="row" className={cell}>
                  {shortDay(point.day)}
                </th>
                <td className={cell}>{integer(point.confirmedOrders)}</td>
                <td className={cell}>{money(point.collectedToman)}</td>
              </tr>
            ))}
          </Table>
        </div>
      </details>
    </Card>
  );
}

function RankedBars({
  title,
  rows,
  href,
}: {
  title: string;
  rows: FestivalReport['topProducts'];
  href?: (slug: string) => string;
}) {
  const peak = Math.max(1, ...rows.map((group) => group.units ?? group.orders));
  return (
    <Card title={title}>
      {rows.length ? (
        <ul className="space-y-2.5">
          {rows.map((row) => {
            const value = row.units ?? row.orders;
            return (
              <li key={row.key} className="space-y-1 text-sm">
                <div className="flex justify-between gap-2">
                  {href && row.slug ? (
                    <Link href={href(row.slug)} className="underline">
                      {row.label}
                    </Link>
                  ) : (
                    <bdi>{row.label}</bdi>
                  )}
                  <span className="shrink-0">
                    {integer(value)} {row.units === null ? 'سفارش' : 'عدد'}
                  </span>
                </div>
                <div
                  aria-hidden="true"
                  className="h-1.5 rounded-full bg-[var(--admin-color-surface-hover)]"
                >
                  <div
                    className="h-full rounded-full bg-[var(--admin-color-primary)]"
                    style={{ width: `${(value / peak) * 100}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className={muted}>{unknown}</p>
      )}
    </Card>
  );
}

function Capacity({
  label,
  used,
  limit,
  description,
}: {
  label: string;
  used: number;
  limit: number;
  description: string;
}) {
  return (
    <div className="space-y-2">
      <label className="grid gap-1 text-sm">
        <span>
          {label} · {limit > 0 ? `${percent.format((used / limit) * 100)}٪` : 'تعریف نشده'}
        </span>
        {limit > 0 && (
          <progress
            value={Math.min(used, limit)}
            max={limit}
            className="h-2 w-full accent-[var(--admin-color-primary)]"
          />
        )}
      </label>
      <p className={muted}>{description}</p>
    </div>
  );
}

function ReportTable({
  report,
  section,
  canReadOrders,
  filterHref,
}: {
  report: FestivalReport;
  section: FestivalReportFilters['section'];
  canReadOrders: boolean;
  filterHref: (filter: { product?: string; category?: string }) => string;
}) {
  if (section === 'orders') {
    if (!report.orders.length)
      return <p className={muted}>سفارشی برای این صفحه یا فیلتر پیدا نشد.</p>;
    return (
      <Table label="سفارش‌ها" headers={['شماره سفارش', 'زمان ثبت یا پرداخت', 'وضعیت', 'وصول قطعی']}>
        {report.orders.map((order) => (
          <tr key={order.id}>
            <th scope="row" className={cell}>
              {canReadOrders ? (
                <Link className="underline" href={`/orders?orderId=${order.id}`}>
                  <bdi>{order.number}</bdi>
                </Link>
              ) : (
                <bdi>{order.number}</bdi>
              )}
            </th>
            <td className={cell}>{formatAdminDateTime(order.occurredAt)}</td>
            <td className={cell}>{campaignOrderLabels[order.state]}</td>
            <td className={cell}>
              {order.collectedToman === null ? 'پرداخت تأیید نشده' : money(order.collectedToman)}
            </td>
          </tr>
        ))}
      </Table>
    );
  }
  if (section === 'quotas') {
    if (!report.quotaItems.length)
      return <p className={muted}>سهمیه‌ای برای این صفحه ثبت نشده است.</p>;
    return (
      <Table
        label="سهمیه‌ها"
        headers={[
          'محصول',
          'سقف',
          'فروش قطعی سایت',
          'فروش دستی',
          'رزرو',
          'مانده',
          'موجودی قابل فروش',
        ]}
      >
        {report.quotaItems.map((row) => (
          <tr key={row.productId}>
            <th scope="row" className={cell}>
              {row.name}
            </th>
            {[
              row.limit,
              row.siteSold,
              row.manualSold,
              row.reserved,
              row.remaining,
              row.sellableStock,
            ].map((value, index) => (
              <td key={index} className={cell}>
                {integer(value)}
              </td>
            ))}
          </tr>
        ))}
      </Table>
    );
  }
  if (!report.groups.length)
    return <p className={muted}>خرید تأییدشده‌ای برای این بخش یا فیلتر پیدا نشد.</p>;
  const offer = section === 'offers';
  const showUnits = !offer && section !== 'sources';
  const amountLabel = offer
    ? 'تخفیف ثبت‌شده'
    : section === 'sources'
      ? 'وصول قطعی'
      : 'ارزش کالایی قبل از تخفیف';
  return (
    <Table
      label={festivalSectionLabels[section]}
      headers={['عنوان', 'سفارش تأییدشده', ...(showUnits ? ['تعداد فروخته‌شده'] : []), amountLabel]}
    >
      {report.groups.map((row) => {
        const version = offer ? row.key.split('/')[1] : null;
        const label = offer
          ? Object.hasOwn(offerLabels, row.label)
            ? offerLabels[row.label]
            : 'نوع پیشنهاد ثبت نشده'
          : row.label;
        return (
          <tr key={row.key}>
            <th scope="row" className={cell}>
              {row.slug && (section === 'products' || section === 'categories') ? (
                <Link
                  className="underline"
                  href={filterHref(
                    section === 'products' ? { product: row.slug } : { category: row.slug },
                  )}
                >
                  {label}
                </Link>
              ) : (
                <bdi>{label}</bdi>
              )}
              {version && /^\d+$/.test(version) && (
                <span className="ms-1 font-normal">نسخهٔ {integer(Number(version))}</span>
              )}
            </th>
            <td className={cell}>{integer(row.orders)}</td>
            {showUnits && <td className={cell}>{row.units === null ? '—' : integer(row.units)}</td>}
            <td className={cell}>{money(row.amountToman)}</td>
          </tr>
        );
      })}
    </Table>
  );
}

export function FestivalAnalyticsView({
  report,
  status,
  filters,
  path,
  canReadOrders,
  canReadOperations,
  canPickCatalog,
}: {
  report: FestivalReport | null;
  status: number;
  filters: FestivalReportFilters;
  path: string;
  canReadOrders: boolean;
  canReadOperations: boolean;
  canPickCatalog: boolean;
}) {
  const href = (changes: Partial<FestivalReportFilters>) =>
    festivalReportHref(path, { ...filters, ...changes });
  const filterHref = (filter: { product?: string; category?: string }) =>
    href({ ...filter, page: 1 });
  const { section, sort } = filters;
  const groupCountSort = section === 'offers' || section === 'sources';
  const sortLabels =
    section === 'orders'
      ? ['جدیدترین', 'قدیمی‌ترین']
      : groupCountSort
        ? ['بیشترین سفارش', 'کمترین سفارش']
        : ['پرفروش‌ترین', 'کم‌فروش‌ترین'];
  return (
    <main className="admin-container min-w-0 space-y-5 py-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">
            {report ? `عملکرد ${report.name}` : 'عملکرد جشنواره'}
          </h1>
          {report && (
            <p className={`mt-1 ${muted}`}>آخرین بررسی {formatAdminDateTime(report.checkedAt)}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {report && canReadOperations && (
            <ButtonLink
              variant="outline"
              href={`/campaigns?id=${report.campaignId}&step=operations`}
            >
              مرکز عملیات
            </ButtonLink>
          )}
          <ButtonLink variant="outline" href="/growth">
            داشبورد رشد
          </ButtonLink>
        </div>
      </header>
      <Card title="فیلتر گزارش" description="بازه تا ۹۲ روز تقویمی به وقت تهران">
        <CampaignReportPeriod
          path={path}
          from={filters.from}
          to={filters.to}
          key={href({ page: 1 })}
        >
          <input type="hidden" name="section" value={section} />
          <input type="hidden" name="sort" value={sort} />
          <div className="grid gap-3 sm:grid-cols-3">
            <CampaignReportCatalogFilters
              canPickCatalog={canPickCatalog}
              manualLabel="ورود دستی نشانی برای دادهٔ تاریخی"
              filters={[
                {
                  name: 'product',
                  value: filters.product,
                  suggestions: report?.topProducts.flatMap(({ slug, label }) =>
                    slug ? [{ slug, label }] : [],
                  ),
                },
                {
                  name: 'category',
                  value: filters.category,
                  suggestions: report?.topCategories.flatMap(({ slug, label }) =>
                    slug ? [{ slug, label }] : [],
                  ),
                },
              ]}
            />
            <label className="grid gap-1 text-sm">
              وضعیت سفارش
              <select
                name="orderState"
                defaultValue={filters.orderState ?? ''}
                className="admin-form-control min-h-10 rounded border px-3"
              >
                <option value="">همهٔ وضعیت‌ها</option>
                {Object.entries(campaignOrderLabels).map(([key, label]) => (
                  <option value={key} key={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {(filters.product || filters.category || filters.orderState) && (
            <Link
              href={href({
                product: undefined,
                category: undefined,
                orderState: undefined,
                page: 1,
              })}
              className="block text-sm underline"
            >
              پاک کردن فیلترهای فروش
            </Link>
          )}
        </CampaignReportPeriod>
      </Card>
      {report ? (
        <ReportSections
          report={report}
          section={section}
          sort={sort}
          sortLabels={sortLabels}
          href={href}
          filterHref={filterHref}
          canReadOrders={canReadOrders}
        />
      ) : (
        <Alert tone="danger">
          {status === 404
            ? 'گزارش برای این جشنواره پیدا نشد.'
            : status === 400
              ? 'بازه و فیلترهای گزارش را بررسی کنید.'
              : 'دریافت گزارش ممکن نشد. صفحه را تازه کنید.'}
        </Alert>
      )}
    </main>
  );
}

function ReportSections({
  report,
  section,
  sort,
  sortLabels,
  href,
  filterHref,
  canReadOrders,
}: {
  report: FestivalReport;
  section: FestivalReportFilters['section'];
  sort: FestivalReportFilters['sort'];
  sortLabels: string[];
  href: (changes: Partial<FestivalReportFilters>) => string;
  filterHref: (filter: { product?: string; category?: string }) => string;
  canReadOrders: boolean;
}) {
  const { totals, quota, budget, funnel } = report;
  const budgetUsed = Math.max(0, budget.discountBudgetToman - budget.remainingDiscountToman);
  const usedQuota = quota.siteSold + quota.manualSold + quota.reserved;
  const [categoryLeader, categoryRunnerUp] = report.topCategories;
  const categoryInsight =
    categoryLeader?.slug &&
    categoryLeader.units !== null &&
    categoryRunnerUp?.units != null &&
    categoryLeader.units > categoryRunnerUp.units
      ? categoryLeader
      : null;
  return (
    <>
      <Card title="خلاصهٔ فروش">
        {!totals.orders && (
          <p role="status" className={`mb-3 ${muted}`}>
            در این بازه با فیلتر انتخاب‌شده سفارشی پیدا نشد.
          </p>
        )}
        <Stats
          items={[
            ['وصول قطعی پیش از بازپرداخت', money(totals.collectedToman)],
            ['خرید تأییدشده', integer(totals.confirmedOrders)],
            ['تعداد اقلام فروخته‌شده', integer(totals.units)],
            [
              'میانگین مبلغ خرید',
              totals.averageOrderToman === null ? unknown : money(totals.averageOrderToman),
            ],
            ['تخفیف جشنواره در خرید قطعی', money(totals.discountToman)],
            ['سفارش‌های مرتبط در بازه', integer(totals.orders)],
            [
              'نرخ تأیید سفارش‌های ثبت‌شده در بازه',
              totals.orderConfirmationPercent === null
                ? unknown
                : `${percent.format(totals.orderConfirmationPercent)}٪`,
            ],
          ]}
        />
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer font-semibold">تعریف شاخص‌ها</summary>
          <ul className={`mt-2 list-inside list-disc space-y-1 ${muted}`}>
            <li>سفارش با تخفیف ثبت‌شدهٔ جشنواره یا انتساب نهایی به آن، یک‌بار در گزارش می‌آید.</li>
            <li>
              وصول و تخفیف قطعی در روز پرداخت ثبت می‌شوند. سفارش‌های دیگر با تاریخ ثبت گزارش
              می‌شوند. مبلغ سفارشِ دارای فیلتر کالا یا دسته، مبلغ کل همان سفارش است.
            </li>
            <li>
              در خرید تخفیف‌دار، جدول کالا از اقلام ثبت‌شده برای جشنواره می‌آید. دسته و برند بر
              پایهٔ عضویت فعلی کاتالوگ‌اند و یک کالا می‌تواند در چند دسته شمرده شود.
            </li>
            <li>
              نرخ تأیید، سهم سفارش‌هایی است که در بازه ثبت شده‌اند و تا پایان همان بازه به خرید قطعی
              رسیده‌اند.
            </li>
          </ul>
        </details>
      </Card>
      {totals.confirmedOrders > 0 && report.daily.length > 0 && (
        <DailyTrends daily={report.daily} />
      )}
      {categoryInsight?.slug && categoryInsight.units !== null && (
        <Card title="تحلیل فروش دسته‌ها">
          <p className="text-sm">
            <Link
              className="font-semibold underline"
              href={filterHref({ category: categoryInsight.slug })}
            >
              {categoryInsight.label}
            </Link>{' '}
            با {integer(categoryInsight.units)} واحد فروخته‌شده در خریدهای قطعی این برش، بیشترین
            تعداد را داشته است.
          </p>
          <p className={`mt-2 ${muted}`}>
            منبع، تعداد اقلام خرید قطعی و عضویت فعلی کالا در کاتالوگ است. یک قلم ممکن است در بیش از
            یک دسته شمرده شود.
          </p>
        </Card>
      )}
      <div className="grid gap-4 lg:grid-cols-3">
        <RankedBars
          title="محصولات برتر"
          rows={report.topProducts}
          href={(product) => filterHref({ product })}
        />
        <RankedBars
          title="دسته‌های برتر"
          rows={report.topCategories}
          href={(category) => filterHref({ category })}
        />
        <RankedBars title="منابع دارای خرید منتسب" rows={report.topSources} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="بودجه و سهمیهٔ جاری" description="مقادیر کل جشنواره در لحظهٔ بررسی">
          <div className="space-y-4">
            <Capacity
              label="بودجهٔ درگیر"
              used={budgetUsed}
              limit={budget.discountBudgetToman}
              description={`سقف ${money(budget.discountBudgetToman)} · مانده ${money(budget.remainingDiscountToman)}`}
            />
            <Capacity
              label="سهمیهٔ درگیر"
              used={usedQuota}
              limit={quota.limit}
              description={`فروش سایت ${integer(quota.siteSold)} · فروش دستی ${integer(quota.manualSold)} · رزرو ${integer(quota.reserved)} · مانده ${integer(quota.remaining)}`}
            />
          </div>
        </Card>
        <Card title="وضعیت سفارش‌ها و پرداخت‌ها">
          {report.states.length > 0 ? (
            <DonutChart
              title="وضعیت سفارش‌ها و پرداخت‌ها"
              centerLabel="سفارش"
              segments={report.states.map((row, index) => ({
                label: campaignOrderLabels[row.state],
                value: row.orders,
                color: [
                  'var(--admin-color-primary)',
                  'var(--admin-color-info)',
                  'var(--admin-color-success)',
                  'var(--admin-color-warning)',
                  'var(--admin-color-danger)',
                ][index % 5],
              }))}
            />
          ) : (
            <p className={muted}>در این بازه سفارشی برای نمایش وجود ندارد.</p>
          )}
        </Card>
      </div>
      <Card title="قیف مشاهده‌شده">
        {funnel ? (
          <div className="space-y-2">
            <p className="text-sm">نشست‌های سنجیده‌شده {integer(funnel.visits)}</p>
            <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {(
                [
                  ['مشاهدهٔ فهرست محصول', funnel.listVisits],
                  ['مشاهدهٔ محصول', funnel.itemVisits],
                  ['افزودن به سبد', funnel.cartVisits],
                  ['ورود به پرداخت', funnel.checkoutVisits],
                ] as const
              ).map(([label, value]) => (
                <li key={label} className="rounded-md bg-[var(--admin-color-surface-subtle)] p-3">
                  <label className="grid gap-1 text-sm">
                    <span>
                      {label} · {integer(value)}
                    </span>
                    <meter min={0} max={funnel.visits} value={value} className="h-3 w-full" />
                  </label>
                </li>
              ))}
            </ol>
          </div>
        ) : (
          <p className={muted}>برای این بازه و فیلتر دادهٔ قابل‌انتساب از مرورگر ثبت نشده است.</p>
        )}
        <p className={`mt-2 ${muted}`}>
          نشست‌ها از سنجش اختیاری مرورگر می‌آیند. آمار سکشن‌های لندینگ در منبع فعلی در دسترس نیست.
        </p>
      </Card>
      <Card id="festival-breakdown" title="جزئیات عملکرد">
        <nav aria-label="بخش‌های گزارش" className="mb-3 flex flex-wrap gap-2">
          {Object.entries(festivalSectionLabels).map(([key, label]) => (
            <ButtonLink
              key={key}
              size="sm"
              variant={key === section ? 'secondary' : 'outline'}
              aria-current={key === section ? 'page' : undefined}
              href={`${href({ section: key as FestivalReportFilters['section'], page: 1, sort: 'desc' })}#festival-breakdown`}
            >
              {label}
            </ButtonLink>
          ))}
        </nav>
        {section !== 'quotas' && (
          <ButtonLink
            size="sm"
            variant="outline"
            className="mb-3"
            href={`${href({ sort: sort === 'desc' ? 'asc' : 'desc', page: 1 })}#festival-breakdown`}
          >
            نمایش {sort === 'desc' ? sortLabels[1] : sortLabels[0]}
          </ButtonLink>
        )}
        <ReportTable
          report={report}
          section={section}
          canReadOrders={canReadOrders}
          filterHref={filterHref}
        />
        {(report.page > 1 || report.hasMore) && (
          <nav aria-label="صفحه‌بندی گزارش" className="mt-3 flex flex-wrap items-center gap-2">
            {report.page > 1 && (
              <ButtonLink
                size="sm"
                variant="outline"
                href={`${href({ page: report.page - 1 })}#festival-breakdown`}
              >
                صفحهٔ قبل
              </ButtonLink>
            )}
            <span className={muted}>صفحهٔ {integer(report.page)}</span>
            {report.hasMore && (
              <ButtonLink
                size="sm"
                variant="outline"
                href={`${href({ page: report.page + 1 })}#festival-breakdown`}
              >
                صفحهٔ بعد
              </ButtonLink>
            )}
          </nav>
        )}
      </Card>
    </>
  );
}
