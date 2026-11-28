import Form from 'next/form';
import Link from 'next/link';
import {
  EntityPagination,
  EntityPeriodFields,
  entityCell,
  entitySelect,
  type EntityFilters,
} from '@/components/seo/search-entity-controls';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/form-control';
import { Select } from '@/components/ui/select';
import { formatAdminInteger } from '@/lib/presentation/formatters';
import {
  entityDetailHref,
  entityEditHref,
  entityKinds,
  entityListHref,
  opportunities,
  type EntityList,
} from '@/lib/seo/search-entity-model';
import { displaySearchMetric } from '@/lib/seo/search-overview-model';

export function SearchEntityListView({
  filters,
  permissions,
  data,
  status,
}: Readonly<{
  filters: EntityFilters;
  permissions: readonly string[];
  data: EntityList | null;
  status: number;
}>) {
  const query = filters.list;
  const percentage = new Intl.NumberFormat('fa-IR', {
    maximumFractionDigits: 2,
    signDisplay: 'exceptZero',
  });
  return (
    <main className="admin-container space-y-6 py-6 sm:py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black">عملکرد صفحات و فرصت‌ها</h1>
        <ButtonLink href="/seo" variant="outline">
          نمای کلی جست‌وجو
        </ButtonLink>
      </header>
      <Card title="بازه و معیار فرصت">
        <Form action="/seo/entities" className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <EntityPeriodFields filters={filters.detail} />
          <label className="grid gap-1 text-sm">
            نوع صفحه
            <Select
              name="kind"
              defaultValue={query.kind}
              className={entitySelect}
              aria-label="نوع صفحه"
              options={entityKinds.map(([key, label]) => ({ value: key, label }))}
            />
          </label>
          <label className="grid gap-1 text-sm">
            نام یا اسلاگ
            <Input name="q" maxLength={160} defaultValue={query.q} />
          </label>
          <label className="grid gap-1 text-sm">
            فرصت
            <Select
              name="opportunity"
              defaultValue={query.opportunity ?? ''}
              className={entitySelect}
              aria-label="فرصت"
              options={[
                { value: '', label: 'همهٔ صفحات' },
                ...opportunities.map(([key, label]) => ({ value: key, label })),
              ]}
            />
          </label>
          <label className="grid gap-1 text-sm">
            سقف نرخ کلیک (درصد)
            <Input
              type="number"
              name="maximumCtrPercent"
              min={0.01}
              max={100}
              step={0.01}
              dir="ltr"
              defaultValue={query.maximumCtrPercent}
              required
            />
          </label>
          <label className="grid gap-1 text-sm">
            حداقل تغییر کلیک (درصد)
            <Input
              type="number"
              name="minimumChangePercent"
              min={1}
              max={1000}
              step={0.01}
              dir="ltr"
              defaultValue={query.minimumChangePercent}
              required
            />
          </label>
          <label className="grid gap-1 text-sm">
            حداقل کلیک دورهٔ قبلی
            <Input
              type="number"
              name="minimumPreviousClicks"
              min={1}
              max={100_000}
              dir="ltr"
              defaultValue={query.minimumPreviousClicks}
              required
            />
          </label>
          <Button type="submit">نمایش صفحات</Button>
        </Form>
      </Card>
      <Card title="عملکرد URL اصلی هر صفحه">
        {!data ? (
          <Alert tone="danger">
            {status === 400
              ? 'بازه یا آستانه‌های گزارش معتبر نیستند.'
              : 'دریافت فهرست صفحات ممکن نشد.'}
          </Alert>
        ) : data.items.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[50rem] text-sm">
              <thead>
                <tr>
                  {['صفحه', 'کلیک', 'نمایش', 'نرخ کلیک', 'تغییر کلیک', 'فرصت', 'عملیات'].map(
                    (label) => (
                      <th scope="col" className={entityCell} key={label}>
                        {label}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {data.items.map((row) => {
                  const edit = entityEditHref(row, permissions);
                  return (
                    <tr key={row.id}>
                      <td className={`${entityCell} max-w-md`}>
                        <Link
                          className="font-semibold underline"
                          href={entityDetailHref(row, {
                            ...filters.detail,
                            urlId: undefined,
                            urlPage: 1,
                          })}
                        >
                          {row.name}
                        </Link>
                        <bdi className="block break-all text-xs text-[var(--admin-color-muted)]">
                          {row.canonicalUrl}
                        </bdi>
                        {!row.sufficient ? (
                          <Badge tone="warning">داده کافی موجود نیست</Badge>
                        ) : null}
                        {row.seoNoIndex ? <Badge tone="neutral">Noindex</Badge> : null}
                      </td>
                      <td className={entityCell}>{displaySearchMetric('clicks', row.clicks)}</td>
                      <td className={entityCell}>
                        {displaySearchMetric('impressions', row.impressions)}
                      </td>
                      <td className={entityCell}>{displaySearchMetric('ctr', row.ctr)}</td>
                      <td className={entityCell}>
                        {row.clickChangePercent === null ? (
                          '—'
                        ) : (
                          <bdi>{percentage.format(row.clickChangePercent)}٪</bdi>
                        )}
                      </td>
                      <td className={entityCell}>
                        {row.opportunities.length
                          ? row.opportunities.map((key) => (
                              <Badge
                                key={key}
                                tone={key === 'growth' ? 'success' : 'warning'}
                                className="mb-1 me-1"
                              >
                                {opportunities.find(([id]) => id === key)?.[1]}
                              </Badge>
                            ))
                          : '—'}
                      </td>
                      <td className={entityCell}>
                        {edit ? (
                          <Link className="underline" href={edit}>
                            ویرایش
                          </Link>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm">صفحه‌ای با این فیلترها و آستانه‌ها پیدا نشد.</p>
        )}
        {data ? (
          <>
            <p className="mt-3 text-xs text-[var(--admin-color-muted)]">
              {formatAdminInteger(data.total)} صفحه
            </p>
            <EntityPagination
              page={data.page}
              limit={data.limit}
              total={data.total}
              label="صفحه‌بندی عملکرد صفحات"
              href={(next) => entityListHref(query, next)}
            />
          </>
        ) : null}
      </Card>
    </main>
  );
}
