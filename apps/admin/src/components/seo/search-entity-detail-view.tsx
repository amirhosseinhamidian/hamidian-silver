import Form from 'next/form';
import Link from 'next/link';
import {
  EntityPagination,
  EntityPeriodFields,
  entityCell,
  type EntityFilters,
} from '@/components/seo/search-entity-controls';
import { SearchOverviewTrend } from '@/components/seo/search-overview-trend';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { formatAdminInteger, toPersianDigits } from '@/lib/presentation/formatters';
import {
  entityDetailHref,
  entityEditHref,
  entityListHref,
  type EntityDetail,
  type EntityIdentity,
} from '@/lib/seo/search-entity-model';
import {
  displaySearchChange,
  displaySearchMetric,
  overviewMetrics,
} from '@/lib/seo/search-overview-model';

const deviceNames: Record<string, string> = { DESKTOP: 'رایانه', MOBILE: 'موبایل', TABLET: 'تبلت' };

function Breakdown({
  title,
  items,
  forDevice = false,
}: Readonly<{ title: string; items: EntityDetail['topQueries']; forDevice?: boolean }>) {
  return (
    <Card title={title}>
      {items.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[26rem] text-sm">
            <thead>
              <tr>
                <th scope="col" className={entityCell}>
                  {forDevice ? 'دستگاه' : 'عبارت'}
                </th>
                {overviewMetrics.map(([key, label]) => (
                  <th scope="col" className={entityCell} key={key}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.label}>
                  <td className={entityCell}>
                    <bdi>{forDevice ? (deviceNames[row.label] ?? row.label) : row.label}</bdi>
                  </td>
                  {overviewMetrics.map(([key]) => (
                    <td key={key} className={entityCell}>
                      {displaySearchMetric(key, row[key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm">برای این URL در بازهٔ انتخابی ردیف قابل نمایش وجود ندارد.</p>
      )}
    </Card>
  );
}

export function SearchEntityDetailView({
  kind,
  filters,
  permissions,
  data,
  status,
}: Readonly<{
  kind: EntityIdentity['kind'];
  filters: EntityFilters;
  permissions: readonly string[];
  data: EntityDetail | null;
  status: number;
}>) {
  const back = entityListHref({ ...filters.list, kind });
  if (!data) {
    return (
      <main className="admin-container space-y-4 py-6">
        <ButtonLink href={back} variant="outline">
          عملکرد صفحات
        </ButtonLink>
        <Alert tone="danger">
          {status === 404
            ? 'URL انتخاب‌شده به این صفحه تعلق ندارد یا صفحه در دسترس نیست.'
            : status === 400
              ? 'بازه یا فیلتر گزارش معتبر نیست.'
              : 'دریافت عملکرد صفحه ممکن نشد.'}
        </Alert>
      </main>
    );
  }
  const { entity, selectedUrl } = data;
  const edit = entityEditHref(entity, permissions);
  const base = { ...filters.detail, urlId: undefined, urlPage: 1 };
  return (
    <main className="admin-container space-y-6 py-6 sm:py-8">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <ButtonLink href={back} variant="outline">
            عملکرد صفحات
          </ButtonLink>
          {edit ? (
            <ButtonLink href={edit} variant="outline">
              ویرایش {entity.name}
            </ButtonLink>
          ) : null}
        </div>
        <h1 className="text-2xl font-black">{entity.name}</h1>
        <p className="text-sm">
          URL اصلی <bdi className="break-all">{entity.canonicalUrl}</bdi>
        </p>
        {entity.seoNoIndex ? <Badge tone="neutral">Noindex</Badge> : null}
      </header>
      <Card title="بازهٔ تحلیل URL">
        <Form
          action={`/seo/entities/${kind}/${entity.id}`}
          className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-5"
        >
          {selectedUrl && !selectedUrl.isCanonical ? (
            <input type="hidden" name="urlId" value={selectedUrl.id} />
          ) : null}
          <EntityPeriodFields filters={filters.detail} />
          <Button type="submit">نمایش گزارش</Button>
        </Form>
      </Card>
      <Card
        title="مقایسه با دورهٔ قبلی"
        description="آمار مربوط به URL انتخابی در Search Console است."
      >
        <p className="mb-2 text-sm">
          <bdi className="break-all">{selectedUrl?.reportedUrl ?? entity.canonicalUrl}</bdi>
        </p>
        <p className="mb-3 text-xs text-[var(--admin-color-muted)]">
          دورهٔ قبلی <bdi>{toPersianDigits(data.previous.startDate)}</bdi> تا{' '}
          <bdi>{toPersianDigits(data.previous.endDate)}</bdi>
        </p>
        {!data.sufficient ? (
          <Alert tone="info">
            داده کافی موجود نیست. تعداد نمایش یا پوشش روزها به حداقل انتخاب‌شده نرسیده است.
          </Alert>
        ) : null}
        <dl className="my-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {overviewMetrics.map(([key, label]) => {
            const change = data.change?.[key];
            return (
              <div key={key} className="rounded-md bg-[var(--admin-color-surface-subtle)] p-3">
                <dt className="text-sm font-medium">{label}</dt>
                <dd className="text-lg font-bold">
                  {displaySearchMetric(key, data.current.metrics?.[key])}
                </dd>
                <dd className="text-xs">
                  قبلی {displaySearchMetric(key, data.previous.metrics?.[key])}
                </dd>
                {change == null ? null : (
                  <dd className="text-xs">
                    تغییر <bdi>{displaySearchChange(key, change)}</bdi>
                  </dd>
                )}
              </div>
            );
          })}
        </dl>
        <p className="text-sm">
          پوشش جاری {formatAdminInteger(data.current.dataDays)} از{' '}
          {formatAdminInteger(data.current.days)} روز · پوشش قبلی{' '}
          {formatAdminInteger(data.previous.dataDays)} از {formatAdminInteger(data.previous.days)}{' '}
          روز
        </p>
      </Card>
      {data.current.metrics ? (
        <Card title="روند روزانهٔ این URL">
          <SearchOverviewTrend daily={data.daily} />
        </Card>
      ) : null}
      {data.cappedQueryDays ? (
        <Alert tone="warning">
          ردیف‌های عبارت در {formatAdminInteger(data.cappedQueryDays)} روز به سقف دریافت رسیده‌اند.
        </Alert>
      ) : null}
      <div className="grid gap-5 xl:grid-cols-2">
        <Breakdown title="عبارت‌های مهم" items={data.topQueries} />
        <Breakdown title="تفکیک دستگاه" items={data.devices} forDevice />
      </div>
      <Card title="URLهای مرتبط" description="با انتخاب هر URL، گزارش همان ردیف باز می‌شود.">
        <ButtonLink href={entityDetailHref(entity, base)} variant="outline" size="sm">
          آمار URL اصلی
        </ButtonLink>
        {data.urls.length ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[38rem] text-sm">
              <thead>
                <tr>
                  {['URL گزارش‌شده', 'نوع اتصال', 'Canonical ثبت‌شده در همگام‌سازی'].map(
                    (label) => (
                      <th key={label} scope="col" className={entityCell}>
                        {label}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {data.urls.map((row) => (
                  <tr key={row.id}>
                    <td className={`${entityCell} max-w-sm break-all`}>
                      <Link
                        className="underline"
                        href={entityDetailHref(entity, { ...filters.detail, urlId: row.id })}
                        aria-current={selectedUrl?.id === row.id ? 'page' : undefined}
                      >
                        <bdi>{row.reportedUrl}</bdi>
                      </Link>
                    </td>
                    <td className={entityCell}>
                      {row.isCanonical
                        ? 'URL اصلی'
                        : row.matchedBy === 'redirect'
                          ? 'مسیر دارای تغییرمسیر'
                          : row.matchedBy === 'direct'
                            ? 'وابسته به مسیر فعلی'
                            : 'نامشخص'}
                      {row.reportedSearch ? (
                        <Badge tone="info" className="ms-1">
                          پارامتردار
                        </Badge>
                      ) : null}
                    </td>
                    <td className={`${entityCell} max-w-sm break-all`}>
                      <bdi>{row.recordedCanonicalPath ?? '—'}</bdi>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-sm">URL گزارش‌شده‌ای در این صفحهٔ فهرست نیست.</p>
        )}
        <EntityPagination
          page={data.urlPage}
          limit={data.urlLimit}
          total={data.urlTotal}
          label="صفحه‌بندی URLهای مرتبط"
          href={(urlPage) => entityDetailHref(entity, { ...filters.detail, urlPage })}
        />
      </Card>
    </main>
  );
}
