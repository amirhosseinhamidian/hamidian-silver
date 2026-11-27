import { cookies } from 'next/headers';
import Link from 'next/link';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { hasAllAdminPermissions } from '@/lib/auth/access-control';
import { createAdminApiClient } from '@/lib/auth/server-api';
import { requireAdminSession } from '@/lib/auth/session';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';
import { formatAdminInteger } from '@/lib/presentation/formatters';
import { refreshSeoOpportunities } from './actions';
import {
  opportunityLabel,
  opportunityPath,
  readPage,
  statusLabels,
  stockLabels,
  type Opportunity,
} from './opportunity-labels';

const resultLabels: Record<string, string> = {
  refreshed: 'صف فرصت‌ها به‌روزرسانی شد.',
  'no-data': 'دادهٔ اخیر و همگام‌شده برای تحلیل در دسترس نیست.',
  unavailable: 'به‌روزرسانی صف ممکن نشد.',
};

export default async function SeoOpportunitiesPage({
  searchParams,
}: Readonly<{ searchParams: Promise<Record<string, string | string[] | undefined>> }>) {
  const user = await requireAdminSession({
    permissions: ['settings.read'],
    returnTo: opportunityPath,
  });
  const params = await searchParams;
  const status =
    typeof params.status === 'string' && Object.hasOwn(statusLabels, params.status)
      ? (params.status as Opportunity['status'])
      : 'PENDING';
  const page = readPage(params.page);
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const data = token
    ? await createAdminApiClient(token)
        .GET('/api/v1/seo/opportunities', {
          params: { query: { status, page } },
          cache: 'no-store',
        })
        .then(
          ({ data }) => data,
          () => undefined,
        )
    : undefined;
  const notice =
    typeof params.result === 'string' && Object.hasOwn(resultLabels, params.result)
      ? resultLabels[params.result]
      : undefined;
  const link = (next: number) =>
    `${opportunityPath}?${new URLSearchParams({ page: String(next), status })}`;

  return (
    <main className="admin-container space-y-6 py-6 sm:py-8 lg:py-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black">فرصت‌های سئو</h1>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/seo" variant="outline">
            عملکرد جست‌وجو
          </ButtonLink>
          {data?.configured && hasAllAdminPermissions(user, ['settings.write']) && (
            <form action={refreshSeoOpportunities}>
              <Button type="submit">تحلیل داده‌های ثبت‌شده</Button>
            </form>
          )}
        </div>
      </header>
      {notice && <p role={params.result === 'unavailable' ? 'alert' : 'status'}>{notice}</p>}
      {!data && <p role="alert">دریافت فرصت‌ها ممکن نشد.</p>}
      {data && !data.configured && <p>Origin فروشگاه یا Property برای این محیط تنظیم نشده است.</p>}
      {data?.configured && (
        <Card title="صف پیشنهادها">
          <nav aria-label="وضعیت تصمیم" className="mb-4 flex flex-wrap gap-2">
            {Object.entries(statusLabels).map(([code, label]) => (
              <ButtonLink
                key={code}
                href={`${opportunityPath}?status=${code}`}
                variant={status === code ? 'secondary' : 'outline'}
                aria-current={status === code ? 'page' : undefined}
              >
                {label}
              </ButtonLink>
            ))}
          </nav>
          {data.items.length ? (
            <ul className="divide-y divide-[var(--admin-color-border)]">
              {data.items.map((item) => (
                <li key={item.id} className="space-y-1 py-4">
                  <Link
                    href={`${opportunityPath}/${item.id}`}
                    className="font-semibold underline underline-offset-4"
                  >
                    {item.title} · {opportunityLabel(item.rule)}
                  </Link>
                  <p className="text-sm">{item.evidence.reason}</p>
                  <p className="text-sm">
                    امتیاز {formatAdminInteger(item.score)} از ۱۰۰ ·{' '}
                    {stockLabels[item.evidence.stock] ?? item.evidence.stock}
                    {!item.active ? ' · شاهد تازه از پیشنهاد پشتیبانی نمی‌کند' : ''}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p>برای این وضعیت پیشنهادی ثبت نشده است.</p>
          )}
          {(page > 1 || data.total > data.pageSize) && (
            <nav aria-label="صفحه‌بندی فرصت‌ها" className="mt-4 flex items-center gap-2">
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
