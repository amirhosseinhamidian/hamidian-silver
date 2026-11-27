import type { components } from '@hamidian/contracts';
import Form from 'next/form';
import { cookies } from 'next/headers';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/form-control';
import { hasAllAdminPermissions } from '@/lib/auth/access-control';
import { createAdminApiClient } from '@/lib/auth/server-api';
import { requireAdminSession } from '@/lib/auth/session';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';
import { formatAdminDateTime, formatAdminInteger } from '@/lib/presentation/formatters';
import { queueIndexSample } from './actions';

type Item = components['schemas']['SeoIndexItemDto'];
const route = '/seo/index-monitoring';

const resultMessages: Record<string, string> = {
  queued: 'نمونه در صف بررسی قرار گرفت.',
  'no-new-sample': 'برای امروز آدرس تازه‌ای به صف اضافه نشد.',
  unavailable: 'ثبت نمونه ممکن نشد. تنظیم اتصال Search Console را بررسی کنید.',
};

const inspectionErrors: Record<string, string> = {
  access_denied: 'دسترسی حساب سرویس به Property کافی نیست.',
  property_not_found: 'شناسهٔ Property در Google پیدا نشد.',
  invalid_credentials: 'اعتبارنامهٔ حساب سرویس قابل استفاده نیست.',
  authentication_failed: 'Google احراز هویت حساب سرویس را نپذیرفت.',
  quota_exceeded: 'سهمیهٔ URL Inspection در Google پر شده است.',
  rate_limited: 'Google درخواست‌ها را موقتاً محدود کرده است.',
  invalid_query: 'Google بررسی این آدرس را نپذیرفت.',
  interrupted: 'آخرین تلاش هنوز نتیجه‌ای ثبت نکرده است.',
};

const differences: Record<string, string> = {
  GOOGLE_PASS_LOCAL_NOINDEX: 'Google تأیید کرده و خزش سایت noindex دیده است.',
  GOOGLE_COVERAGE_HTTP_200: 'صفحه HTTP 200 دارد و وضعیت ثبت‌شدهٔ Google نیازمند بررسی است.',
  GOOGLE_CANONICAL_DIFFERS: 'Canonical انتخابی Google با Canonical مشاهده‌شده تفاوت دارد.',
  GOOGLE_PASS_OUTSIDE_SITEMAP: 'Google تأیید کرده و آدرس در نمونهٔ Sitemap دیده نشده است.',
};

function Observed({ value, stale }: Readonly<{ value: string; stale?: boolean }>) {
  return (
    <p className="text-xs text-[var(--admin-color-muted)]">
      {formatAdminDateTime(value)}
      {stale ? ' · قدیمی' : ''}
    </p>
  );
}

function IndexEvidence({ item }: Readonly<{ item: Item }>) {
  const { google, technical, sitemap } = item;
  return (
    <tr className="border-b border-[var(--admin-color-border)] align-top">
      <th scope="row" className="min-w-52 px-3 py-3 text-start font-medium">
        <bdi className="break-all" dir="ltr">
          {item.path}
        </bdi>
        {item.queued && <p className="text-xs">در صف</p>}
        {item.lastError && (
          <p className="mt-1 text-xs">
            {inspectionErrors[item.lastError] ?? 'آخرین تلاش موفق نبود.'}
            {item.lastAttemptAt ? ` · ${formatAdminDateTime(item.lastAttemptAt)}` : ''}
          </p>
        )}
      </th>
      <td className="min-w-64 space-y-1 px-3 py-3">
        {google ? (
          <>
            <p>
              {google.coverageState ?? 'وضعیت پوشش نامشخص'}
              {google.incomplete ? ' · دادهٔ ناقص' : ''}
            </p>
            <Observed value={google.observedAt} stale={google.stale} />
            <details>
              <summary className="cursor-pointer text-xs">جزئیات URL Inspection</summary>
              <p>
                نتیجهٔ Google <bdi dir="ltr">{google.verdict ?? '—'}</bdi>
              </p>
              <p>
                وضعیت ایندکس <bdi dir="ltr">{google.indexingState ?? '—'}</bdi>
              </p>
              <p>
                وضعیت دریافت <bdi dir="ltr">{google.pageFetchState ?? '—'}</bdi>
              </p>
              <p>
                آخرین خزش Google{' '}
                {google.lastCrawlAt ? formatAdminDateTime(google.lastCrawlAt) : '—'}
              </p>
              <p>
                Canonical انتخابی Google{' '}
                <bdi className="break-all" dir="ltr">
                  {google.googleCanonical ?? '—'}
                </bdi>
              </p>
              <p>
                Canonical اعلام‌شده{' '}
                <bdi className="break-all" dir="ltr">
                  {google.userCanonical ?? '—'}
                </bdi>
              </p>
            </details>
          </>
        ) : (
          'هنوز نتیجه‌ای از Google دریافت نشده است.'
        )}
      </td>
      <td className="min-w-52 space-y-1 px-3 py-3">
        {technical ? (
          <>
            <p>
              {technical.status ? <bdi dir="ltr">HTTP {technical.status}</bdi> : 'بدون پاسخ HTTP'}
              {technical.failure ? ' · خزش کامل نشد' : ''}
            </p>
            <Observed value={technical.observedAt} stale={technical.stale} />
            {technical.noindex && (
              <p>
                <bdi dir="ltr">noindex</bdi>
              </p>
            )}
            {technical.finalPath !== item.path && (
              <p>
                مقصد خزش{' '}
                <bdi className="break-all" dir="ltr">
                  {technical.finalPath}
                </bdi>
              </p>
            )}
            {technical.canonical && (
              <bdi className="block break-all" dir="ltr">
                {technical.canonical}
              </bdi>
            )}
          </>
        ) : (
          'خزش ثبت نشده است.'
        )}
      </td>
      <td className="min-w-36 space-y-1 px-3 py-3">
        {sitemap ? (
          <>
            <p>{sitemap.present ? 'موجود' : 'غایب'}</p>
            <Observed value={sitemap.observedAt} stale={sitemap.stale} />
          </>
        ) : (
          'نامشخص'
        )}
      </td>
      <td className="min-w-52 px-3 py-3">
        {item.differences.length > 0 ? (
          <ul className="space-y-1">
            {item.differences.map((code) => (
              <li key={code}>{differences[code] ?? code}</li>
            ))}
          </ul>
        ) : (
          '—'
        )}
      </td>
    </tr>
  );
}

export default async function IndexMonitoringPage({
  searchParams,
}: Readonly<{ searchParams: Promise<Record<string, string | string[] | undefined>> }>) {
  const user = await requireAdminSession({ permissions: ['settings.read'], returnTo: route });
  const params = await searchParams;
  const q = typeof params.q === 'string' ? params.q.trim().slice(0, 180) : '';
  const page =
    typeof params.page === 'string' && /^\d{1,5}$/.test(params.page)
      ? Math.max(1, Math.min(10_000, Number(params.page)))
      : 1;
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const data = token
    ? await createAdminApiClient(token)
        .GET('/api/v1/seo/index-monitoring', {
          params: { query: { q: q || undefined, page } },
          cache: 'no-store',
        })
        .then(
          ({ data }) => data,
          () => undefined,
        )
    : undefined;
  const result =
    typeof params.result === 'string' && Object.hasOwn(resultMessages, params.result)
      ? resultMessages[params.result]
      : undefined;
  const pageLink = (value: number) =>
    `${route}?${new URLSearchParams({ page: String(value), ...(q ? { q } : {}) })}`;

  return (
    <main className="admin-container space-y-6 py-6 sm:py-8 lg:py-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black">پایش ایندکس</h1>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/seo" variant="outline">
            عملکرد جست‌وجو
          </ButtonLink>
          <ButtonLink href={`${route}/coverage-reports`} variant="outline">
            گزارش‌های Coverage
          </ButtonLink>
          {data?.configured && hasAllAdminPermissions(user, ['settings.write']) && (
            <form action={queueIndexSample}>
              <Button type="submit">ثبت نمونه در صف</Button>
            </form>
          )}
        </div>
      </header>
      {result && <p role="status">{result}</p>}
      {!data && <p role="alert">دریافت گزارش پایش ممکن نشد.</p>}
      {data && (
        <>
          <Card
            title="صف و سهمیهٔ URL Inspection"
            description="نتیجهٔ Google از نسخهٔ ثبت‌شده در ایندکس می‌آید."
          >
            <div className="space-y-2 text-sm">
              <p>
                سهمیهٔ محلی امروز {formatAdminInteger(data.used)} از{' '}
                {formatAdminInteger(data.limit)} · بازنشانی{' '}
                {formatAdminDateTime(data.budgetResetsAt)}
              </p>
              <p>
                {formatAdminInteger(data.pending)} آدرس در صف · زمان‌بندی خودکار{' '}
                {data.automatic ? 'روشن' : 'خاموش'}
              </p>
              {data.property && (
                <p>
                  Property <bdi dir="ltr">{data.property}</bdi>
                </p>
              )}
              {!data.configured && <p>اتصال URL Inspection برای این محیط آماده نیست.</p>}
              {data.pausedUntil && (
                <p role="status">
                  {inspectionErrors[data.pauseReason ?? ''] ?? 'صف موقتاً مکث دارد.'} ادامه از{' '}
                  {formatAdminDateTime(data.pausedUntil)}
                </p>
              )}
            </div>
          </Card>
          <Card title="شواهد هر آدرس">
            <Form action={route} className="mb-4 flex flex-wrap items-end gap-2">
              <label className="grid gap-1 text-sm">
                جست‌وجوی مسیر <Input name="q" defaultValue={q} maxLength={180} dir="ltr" />
              </label>
              <Button variant="outline" type="submit">
                جست‌وجو
              </Button>
            </Form>
            {data.items.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-start text-sm">
                  <thead className="border-b border-[var(--admin-color-border)]">
                    <tr>
                      {[
                        'آدرس',
                        'وضعیت Google',
                        'بررسی فنی سایت',
                        'Sitemap',
                        'اختلاف‌های قابل بررسی',
                      ].map((name) => (
                        <th key={name} scope="col" className="px-3 py-2 text-start">
                          {name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((item) => (
                      <IndexEvidence key={item.path} item={item} />
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>در این صفحه آدرسی برای نمایش وجود ندارد.</p>
            )}
            {(page > 1 || data.total > data.pageSize) && (
              <nav className="mt-4 flex gap-2" aria-label="صفحه‌بندی آدرس‌های پایش">
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
        </>
      )}
    </main>
  );
}
