import Form from 'next/form';
import { SearchOverviewTrend } from '@/components/seo/search-overview-trend';
import { Alert } from '@/components/ui/alert';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/form-control';
import {
  formatAdminDateTime,
  formatAdminInteger,
  toPersianDigits,
} from '@/lib/presentation/formatters';
import {
  displaySearchChange,
  displaySearchMetric,
  overviewHref,
  overviewMetrics,
  searchSegments,
  searchSorts,
  searchTypes,
  type OverviewFilters,
  type OverviewPeriod,
  type SearchOverview,
  type SearchOverviewRows,
} from '@/lib/seo/search-overview-model';

const select =
  'w-full rounded-md border border-[var(--admin-color-border)] bg-[var(--admin-color-surface)] p-2';
const cell = 'border-b border-[var(--admin-color-border)] px-3 py-2 text-start';

function periodLabel(period: OverviewPeriod) {
  return (
    <>
      <bdi dir="ltr">{toPersianDigits(period.startDate)}</bdi> تا{' '}
      <bdi dir="ltr">{toPersianDigits(period.endDate)}</bdi>
    </>
  );
}

function SyncState({
  overview,
  activePauseUntil,
}: Readonly<{ overview: SearchOverview; activePauseUntil: string | null }>) {
  const { sync, property } = overview;
  const errorText: Record<string, string> = {
    not_configured: 'اتصال Google Search Console تنظیم نشده است.',
    invalid_credentials: 'اعتبارنامهٔ همگام‌سازی در سرور قابل استفاده نیست.',
    access_denied: 'دسترسی سرور به این Property تأیید نشد.',
    quota_exceeded: 'سهمیهٔ همگام‌سازی موقتاً پر شده است.',
    rate_limited: 'گوگل موقتاً درخواست‌های تازه را محدود کرده است.',
  };
  return (
    <div className="space-y-3">
      <dl className="grid gap-3 text-sm sm:grid-cols-3">
        <div>
          <dt>Property</dt>
          <dd className="mt-1 font-semibold">
            <bdi>{property ?? 'تنظیم نشده'}</bdi>
          </dd>
        </div>
        <div>
          <dt>آخرین همگام‌سازی موفق</dt>
          <dd className="mt-1 font-semibold">
            {sync.lastSuccessAt ? formatAdminDateTime(sync.lastSuccessAt) : 'ثبت نشده'}
          </dd>
        </div>
        <div>
          <dt>آخرین روز همگام‌شده</dt>
          <dd className="mt-1 font-semibold">
            <bdi>{sync.latestSyncedDate ? toPersianDigits(sync.latestSyncedDate) : 'ثبت نشده'}</bdi>
          </dd>
        </div>
      </dl>
      {sync.lastErrorCode ? (
        <Alert tone="warning">
          {errorText[sync.lastErrorCode] ??
            'آخرین تلاش همگام‌سازی موفق نبود. داده‌های ذخیره‌شده همچنان نمایش داده می‌شوند.'}
        </Alert>
      ) : null}
      {activePauseUntil ? (
        <Alert tone="warning">صف تا {formatAdminDateTime(activePauseUntil)} متوقف است.</Alert>
      ) : null}
      {!sync.enabled || !sync.scheduledForType ? (
        <Alert tone="info">همگام‌سازی خودکار برای این نوع جست‌وجو فعال نیست.</Alert>
      ) : null}
      {sync.lastRunStatus === 'RUNNING' ? (
        <Alert tone="info">همگام‌سازی در حال انجام است.</Alert>
      ) : null}
    </div>
  );
}

function Tables({
  filters,
  rows,
  status,
}: Readonly<{ filters: OverviewFilters; rows: SearchOverviewRows | null; status: number }>) {
  const { kind, q, sort, direction } = filters.rows;
  const pageCount = rows ? Math.max(1, Math.min(5000, Math.ceil(rows.total / rows.limit))) : 1;
  return (
    <Card id="seo-tables" title="عبارت‌ها و صفحه‌ها">
      <div className="flex gap-2">
        {(
          [
            ['query', 'عبارت‌ها'],
            ['page', 'صفحه‌ها'],
          ] as const
        ).map(([value, label]) => (
          <ButtonLink
            key={value}
            aria-current={value === kind ? 'page' : undefined}
            variant={value === kind ? 'secondary' : 'outline'}
            href={overviewHref(filters, { kind: value, q: undefined, page: 1 })}
          >
            {label}
          </ButtonLink>
        ))}
      </div>
      {rows?.available !== false ? (
        <Form action="/seo" className="mt-4 grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries({
            startDate: filters.base.startDate,
            endDate: filters.base.endDate,
            searchType: filters.base.searchType,
            segment: filters.segment,
            kind,
          }).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <label className="grid gap-1 text-sm">
            جست‌وجو در جدول
            <Input name="q" maxLength={160} defaultValue={q} />
          </label>
          <label className="grid gap-1 text-sm">
            مرتب‌سازی
            <select name="sort" defaultValue={sort} className={select}>
              {searchSorts.map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            ترتیب
            <select name="direction" defaultValue={direction} className={select}>
              <option value="desc">نزولی</option>
              <option value="asc">صعودی</option>
            </select>
          </label>
          <Button type="submit" variant="outline">
            اعمال در جدول
          </Button>
        </Form>
      ) : null}
      <p className="my-4 text-sm leading-6 text-[var(--admin-color-muted)]">
        گوگل برخی عبارت‌ها را برای حریم خصوصی حذف می‌کند و ممکن است فقط ردیف‌های برتر را برگرداند.
        آمار صفحه و Property هم با سطح تجمیع متفاوت محاسبه می‌شوند. اختلاف مجموع جدول با نمای کلی
        طبیعی است.
      </p>
      {!rows ? (
        <Alert tone="danger">
          {status === 400 ? 'بازه یا جست‌وجوی جدول معتبر نیست.' : 'دریافت ردیف‌های گزارش ممکن نشد.'}
        </Alert>
      ) : !rows.available ? (
        <Alert tone="info">
          {filters.base.device && kind === 'query'
            ? 'با فیلتر دستگاه، ردیف‌های جدول صفحه‌ها در دسترس‌اند.'
            : 'برای تفکیک برند، ردیف عبارت و صفحه در تاریخچه ذخیره نشده است.'}
        </Alert>
      ) : (
        <>
          {rows.cappedDays > 0 ? (
            <Alert tone="warning">
              خروجی ذخیره‌شده در {formatAdminInteger(rows.cappedDays)} روز به سقف دریافت ردیف رسیده
              است.
            </Alert>
          ) : null}
          {rows.items.length ? (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[36rem] text-sm">
                <thead>
                  <tr>
                    <th scope="col" className={cell}>
                      {kind === 'query' ? 'عبارت' : 'URL گزارش‌شده'}
                    </th>
                    {overviewMetrics.map(([key, label]) => (
                      <th scope="col" key={key} className={cell}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.items.map((row) => (
                    <tr key={row.label}>
                      <td className={`${cell} max-w-sm break-all`}>
                        <bdi>{row.label}</bdi>
                      </td>
                      {overviewMetrics.map(([key]) => (
                        <td key={key} className={cell}>
                          {displaySearchMetric(key, row[key])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-4 text-sm">
              {rows.syncedDays === 0
                ? 'در این بازه هنوز داده‌ای همگام نشده است.'
                : 'ردیفی برای جست‌وجو و صفحهٔ انتخاب‌شده پیدا نشد.'}
            </p>
          )}
          <nav
            aria-label="صفحه‌بندی ردیف‌های سئو"
            className="mt-4 flex flex-wrap items-center gap-3"
          >
            {rows.page > 1 ? (
              <ButtonLink variant="outline" href={overviewHref(filters, { page: rows.page - 1 })}>
                قبلی
              </ButtonLink>
            ) : null}
            <span className="text-sm">
              صفحهٔ {formatAdminInteger(rows.page)} از {formatAdminInteger(pageCount)} ·{' '}
              {formatAdminInteger(rows.total)} ردیف
            </span>
            {rows.page < pageCount ? (
              <ButtonLink variant="outline" href={overviewHref(filters, { page: rows.page + 1 })}>
                بعدی
              </ButtonLink>
            ) : null}
          </nav>
        </>
      )}
    </Card>
  );
}

export function SearchOverviewView({
  filters,
  overview,
  activePauseUntil,
  rows,
  overviewStatus,
  rowsStatus,
}: Readonly<{
  filters: OverviewFilters;
  overview: SearchOverview | null;
  activePauseUntil: string | null;
  rows: SearchOverviewRows | null;
  overviewStatus: number;
  rowsStatus: number;
}>) {
  return (
    <main className="admin-container space-y-6 py-6 sm:py-8 lg:py-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black">عملکرد جست‌وجو</h1>
        <ButtonLink href="/seo/entities" variant="outline">
          عملکرد صفحات و فرصت‌ها
        </ButtonLink>
      </header>
      <Card
        title="بازه و فیلترها"
        description="روزهای میلادی بر اساس ساعت اقیانوس آرام و حداکثر بازه ۹۰ روز است."
      >
        <Form action="/seo" className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <input type="hidden" name="kind" value={filters.rows.kind} />
          <label className="grid gap-1 text-sm">
            از روز
            <Input
              type="date"
              name="startDate"
              dir="ltr"
              defaultValue={filters.base.startDate}
              required
            />
          </label>
          <label className="grid gap-1 text-sm">
            تا روز
            <Input
              type="date"
              name="endDate"
              dir="ltr"
              defaultValue={filters.base.endDate}
              required
            />
          </label>
          <label className="grid gap-1 text-sm">
            نوع جست‌وجو
            <select name="searchType" defaultValue={filters.base.searchType} className={select}>
              {searchTypes.map(([key, label]) => (
                <option value={key} key={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            گروه
            <select name="segment" defaultValue={filters.segment} className={select}>
              {searchSegments.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit">نمایش گزارش</Button>
        </Form>
      </Card>
      {overview ? (
        <>
          <Card title="وضعیت همگام‌سازی">
            <SyncState overview={overview} activePauseUntil={activePauseUntil} />
          </Card>
          <Card title="مقایسه با دورهٔ قبلی">
            <p className="text-sm">بازهٔ جاری {periodLabel(overview.current)}</p>
            <p className="mt-1 text-sm text-[var(--admin-color-muted)]">
              بازهٔ قبلی {periodLabel(overview.previous)}
            </p>
            {!overview.current.metrics ? (
              <Alert className="mt-3" tone="info">
                {overview.scope === 'brand'
                  ? 'گوگل برای این بازه و گروه برند دادهٔ قابل‌اتکا نداده است.'
                  : 'برای این بازه و فیلتر هنوز داده‌ای در تاریخچه وجود ندارد.'}
              </Alert>
            ) : null}
            <div className="my-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {overviewMetrics.map(([key, label]) => {
                const delta = overview.change?.[key];
                return (
                  <div className="rounded-md bg-[var(--admin-color-surface-subtle)] p-3" key={key}>
                    <h3 className="text-sm font-semibold">{label}</h3>
                    <p className="mt-1 text-lg font-bold">
                      {displaySearchMetric(key, overview.current.metrics?.[key])}
                    </p>
                    <p className="mt-1 text-xs">
                      دورهٔ قبلی {displaySearchMetric(key, overview.previous.metrics?.[key])}
                    </p>
                    {delta != null ? (
                      <p className="mt-1 text-xs">
                        تغییر <bdi>{displaySearchChange(key, delta)}</bdi>
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
            <p className="text-sm">
              پوشش داده در بازهٔ جاری {formatAdminInteger(overview.current.dataDays)} از{' '}
              {formatAdminInteger(overview.current.days)} روز و در بازهٔ قبلی{' '}
              {formatAdminInteger(overview.previous.dataDays)} از{' '}
              {formatAdminInteger(overview.previous.days)} روز.
            </p>
            {!overview.change ? (
              <p className="mt-1 text-xs text-[var(--admin-color-muted)]">
                تغییر پس از کامل‌شدن پوشش هر دو بازه نمایش داده می‌شود.
              </p>
            ) : null}
          </Card>
          {overview.current.metrics ? (
            <Card title="روند عملکرد">
              <SearchOverviewTrend daily={overview.daily} weekly={overview.weekly} />
            </Card>
          ) : null}
        </>
      ) : (
        <Alert tone="danger">
          {overviewStatus === 400
            ? 'بازه یا ترکیب فیلترها معتبر نیست.'
            : 'دریافت نمای عملکرد جست‌وجو ممکن نشد.'}
        </Alert>
      )}
      <Tables filters={filters} rows={rows} status={rowsStatus} />
    </main>
  );
}
