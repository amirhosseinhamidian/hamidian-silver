import type { components } from '@hamidian/contracts';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { hasAllAdminPermissions } from '@/lib/auth/access-control';
import { createAdminApiClient } from '@/lib/auth/server-api';
import { requireAdminSession } from '@/lib/auth/session';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';
import { formatAdminDateTime, formatAdminInteger } from '@/lib/presentation/formatters';
import { scanSeoIssues } from './actions';
import { issueSeverityLabels, issueStatusLabels, issueTitle } from './issue-labels';

type Status = components['schemas']['SeoIssueItemDto']['status'];
const route = '/seo/issues';

export default async function SeoIssuesPage({
  searchParams,
}: Readonly<{ searchParams: Promise<Record<string, string | string[] | undefined>> }>) {
  const user = await requireAdminSession({ permissions: ['settings.read'], returnTo: route });
  const params = await searchParams;
  const status =
    typeof params.status === 'string' && Object.hasOwn(issueStatusLabels, params.status)
      ? (params.status as Status)
      : undefined;
  const page =
    typeof params.page === 'string' && /^\d{1,5}$/.test(params.page)
      ? Math.max(1, Math.min(10_000, Number(params.page)))
      : 1;
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const data = token
    ? await createAdminApiClient(token)
        .GET('/api/v1/seo/issues', {
          params: { query: { page, status } },
          cache: 'no-store',
        })
        .then(
          ({ data }) => data,
          () => undefined,
        )
    : undefined;
  const link = (next: number) =>
    `${route}?${new URLSearchParams({ page: String(next), ...(status ? { status } : {}) })}`;

  return (
    <main className="admin-container space-y-6 py-6 sm:py-8 lg:py-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black">هشدارهای سئو</h1>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/seo" variant="outline">
            عملکرد جست‌وجو
          </ButtonLink>
          {data?.configured && hasAllAdminPermissions(user, ['settings.write']) && (
            <form action={scanSeoIssues}>
              <Button type="submit">بررسی داده‌های ثبت‌شده</Button>
            </form>
          )}
        </div>
      </header>
      {params.result === 'scanned' && <p role="status">بررسی داده‌ها انجام شد.</p>}
      {params.result === 'unavailable' && <p role="alert">بررسی داده‌ها ممکن نشد.</p>}
      {!data && <p role="alert">دریافت هشدارها ممکن نشد.</p>}
      {data && !data.configured && (
        <p>نشانی عمومی فروشگاه یا Property سئو برای این محیط تنظیم نشده است.</p>
      )}
      {data?.configured && (
        <Card title="صندوق رسیدگی">
          <nav aria-label="فیلتر وضعیت هشدار" className="mb-4 flex flex-wrap gap-2">
            <ButtonLink
              variant={status ? 'outline' : 'secondary'}
              href={route}
              aria-current={status ? undefined : 'page'}
            >
              همه
            </ButtonLink>
            {Object.entries(issueStatusLabels).map(([code, label]) => (
              <ButtonLink
                key={code}
                href={`${route}?status=${code}`}
                variant={code === status ? 'secondary' : 'outline'}
                aria-current={code === status ? 'page' : undefined}
              >
                {label}
              </ButtonLink>
            ))}
          </nav>
          {data.items.length ? (
            <ul className="divide-y divide-[var(--admin-color-border)]">
              {data.items.map((issue) => (
                <li key={issue.id} className="py-3">
                  <Link
                    href={`${route}/${issue.id}`}
                    className="font-semibold underline underline-offset-4"
                  >
                    {issueTitle(issue.rule)}
                  </Link>
                  <p className="break-all text-sm">
                    <bdi dir="ltr">{issue.subject}</bdi>
                  </p>
                  <p className="text-sm">
                    {issueSeverityLabels[issue.severity]} · {issueStatusLabels[issue.status]} ·{' '}
                    {issue.owner?.name ?? 'بدون مسئول'} · {formatAdminDateTime(issue.observedAt)}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p>برای این وضعیت هشداری ثبت نشده است.</p>
          )}
          {(page > 1 || data.total > data.pageSize) && (
            <nav className="mt-4 flex items-center gap-2" aria-label="صفحه‌بندی هشدارها">
              {page > 1 && (
                <ButtonLink href={link(page - 1)} variant="outline">
                  قبلی
                </ButtonLink>
              )}
              <span>{formatAdminInteger(page)}</span>
              {page * data.pageSize < data.total && (
                <ButtonLink href={link(page + 1)} variant="outline">
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
