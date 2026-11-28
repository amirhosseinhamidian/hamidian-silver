import Form from 'next/form';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/form-control';
import { Select } from '@/components/ui/select';
import { hasAllAdminPermissions } from '@/lib/auth/access-control';
import { createAdminApiClient } from '@/lib/auth/server-api';
import { requireAdminSession } from '@/lib/auth/session';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';
import { formatAdminDateTime, formatAdminInteger } from '@/lib/presentation/formatters';
import { uploadSearchCoverage } from '../actions';

const route = '/seo/index-monitoring/coverage-reports';
const results: Record<string, string> = {
  imported: 'گزارش Coverage ثبت شد.',
  invalid:
    'فایل یا تاریخ گزارش معتبر نیست. خروجی انگلیسی CSV یا ZIP مربوط به همین دامنه را انتخاب کنید.',
  unavailable: 'ثبت گزارش ممکن نشد. تنظیم Property و نشانی عمومی فروشگاه را بررسی کنید.',
};

export default async function CoveragePage({
  searchParams,
}: Readonly<{ searchParams: Promise<Record<string, string | string[] | undefined>> }>) {
  const user = await requireAdminSession({ permissions: ['settings.read'], returnTo: route });
  const params = await searchParams;
  const id = typeof params.id === 'string' ? params.id : undefined;
  const reason = typeof params.reason === 'string' ? params.reason.slice(0, 240) : '';
  const page =
    typeof params.page === 'string' && /^\d{1,5}$/.test(params.page)
      ? Math.max(1, Math.min(10_000, Number(params.page)))
      : 1;
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const data = token
    ? await createAdminApiClient(token)
        .GET('/api/v1/seo/index-monitoring/coverage', {
          params: { query: { id, reason: reason || undefined, page } },
          cache: 'no-store',
        })
        .then(
          ({ data }) => data,
          () => undefined,
        )
    : undefined;
  const note =
    typeof params.result === 'string' && Object.hasOwn(results, params.result)
      ? results[params.result]
      : undefined;
  const pageLink = (next: number) =>
    `${route}?${new URLSearchParams({
      page: String(next),
      ...(data?.report ? { id: data.report.id } : {}),
      ...(reason ? { reason } : {}),
    })}`;

  return (
    <main className="admin-container space-y-6 py-6 sm:py-8 lg:py-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black">گزارش‌های Coverage</h1>
        <ButtonLink href="/seo/index-monitoring" variant="outline">
          پایش ایندکس
        </ButtonLink>
      </header>
      {note && <p role={params.result === 'imported' ? 'status' : 'alert'}>{note}</p>}
      {!data && <p role="alert">دریافت گزارش Coverage ممکن نشد.</p>}
      {hasAllAdminPermissions(user, ['settings.write']) && (
        <Card
          title="ورود خروجی Search Console"
          description="فایل انگلیسی CSV یا ZIP از بخش Page indexing یا فهرست نمونهٔ یک مشکل را انتخاب کنید."
        >
          <form action={uploadSearchCoverage} className="flex flex-wrap items-end gap-3 text-sm">
            <label className="grid gap-1">
              گزارش <Input type="file" name="file" accept=".csv,.zip" required />
            </label>
            <label className="grid gap-1">
              عنوان گزارش یا دلیل Drilldown <Input name="label" maxLength={120} required />
            </label>
            <label className="grid gap-1">
              تاریخ گزارش <Input type="date" name="reportDate" dir="ltr" required />
            </label>
            <Button type="submit">ثبت گزارش</Button>
          </form>
        </Card>
      )}
      {data && !data.report && <p>هنوز گزارشی وارد نشده است.</p>}
      {data?.report && (
        <Card
          title={data.report.label}
          description={`تاریخ گزارش ${data.report.reportDate} · زمان ورود ${formatAdminDateTime(data.report.importedAt)}`}
        >
          <ul className="mb-4 flex flex-wrap gap-3 text-sm" aria-label="گزارش‌های اخیر">
            {data.history.map((report) => (
              <li key={report.id}>
                <Link
                  aria-current={report.id === data.report?.id ? 'page' : undefined}
                  className="underline underline-offset-4"
                  href={`${route}?id=${report.id}`}
                >
                  {report.label} · <bdi dir="ltr">{report.reportDate}</bdi>
                </Link>
              </li>
            ))}
          </ul>
          <Form action={route} className="mb-4 flex flex-wrap items-end gap-2">
            <input type="hidden" name="id" value={data.report.id} />
            <label className="grid gap-1 text-sm">
              دلیل گزارش
              <Select
                name="reason"
                defaultValue={reason}
                className="h-10 rounded border border-[var(--admin-color-border)] bg-[var(--admin-color-surface)] px-2"
                aria-label="دلیل گزارش"
                options={[
                  { value: '', label: 'همهٔ دلایل' },
                  ...data.reasons.map((reason) => ({ value: reason, label: reason })),
                ]}
              />
            </label>
            <Button variant="outline" type="submit">
              اعمال فیلتر
            </Button>
          </Form>
          {data.rows.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    {[
                      'دلیل',
                      'آدرس نمونه',
                      'آخرین خزش گزارش‌شده',
                      'تعداد صفحات',
                      'اعتبارسنجی Google',
                    ].map((header) => (
                      <th key={header} scope="col" className="px-3 py-2 text-start">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row, index) => (
                    <tr
                      key={`${page}:${index}`}
                      className="border-t border-[var(--admin-color-border)] align-top"
                    >
                      <td className="px-3 py-2">{row.reason ?? '—'}</td>
                      <td className="px-3 py-2">
                        <bdi dir="ltr" className="break-all">
                          {row.url ?? '—'}
                        </bdi>
                      </td>
                      <td className="px-3 py-2">
                        <bdi dir="ltr">{row.lastCrawled ?? '—'}</bdi>
                      </td>
                      <td className="px-3 py-2">
                        {row.pages === null ? '—' : formatAdminInteger(row.pages)}
                      </td>
                      <td className="px-3 py-2">{row.validation ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>برای این فیلتر ردیفی ثبت نشده است.</p>
          )}
          {(page > 1 || data.total > data.pageSize) && (
            <nav className="mt-4 flex gap-2" aria-label="صفحه‌بندی گزارش Coverage">
              {page > 1 && (
                <ButtonLink href={pageLink(page - 1)} variant="outline">
                  قبلی
                </ButtonLink>
              )}
              {page * data.pageSize < data.total && (
                <ButtonLink href={pageLink(page + 1)} variant="outline">
                  بعدی
                </ButtonLink>
              )}
            </nav>
          )}
        </Card>
      )}
    </main>
  );
}
