import { cookies } from 'next/headers';
import { Alert } from '@/components/ui/alert';
import { ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { requireAdminSession } from '@/lib/auth/session';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';
import { readJsonResponse, requestAdminCatalog } from '@/lib/catalog/catalog-api';
import {
  formatAdminDateTime,
  formatAdminInteger,
  formatAdminToman,
} from '@/lib/presentation/formatters';
import {
  parseWalletMaintenanceReport,
  walletIssueLabels,
  walletTotalLabels,
} from '@/lib/reward-policies/wallet-maintenance';

export const dynamic = 'force-dynamic';

const path = '/reward-policies/maintenance';
const maxPage = 10_000;
type SearchParams = { status?: string; page?: string };

async function loadReport(query: URLSearchParams) {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const response = await requestAdminCatalog(
      `/api/v1/wallet/admin/maintenance/report?${query}`,
      token,
    );
    return response.ok ? parseWalletMaintenanceReport(await readJsonResponse(response)) : null;
  } catch {
    return null;
  }
}

export default async function WalletMaintenancePage({
  searchParams,
}: Readonly<{ searchParams: Promise<SearchParams> }>) {
  const user = await requireAdminSession({ permissions: ['finance.read'], returnTo: path });
  const filters = await searchParams;
  const status = filters.status === 'resolved' ? 'resolved' : 'open';
  const requestedPage = Number(filters.page);
  const page =
    Number.isInteger(requestedPage) && requestedPage >= 1 && requestedPage <= maxPage
      ? requestedPage
      : 1;
  const report = await loadReport(new URLSearchParams({ status, page: String(page) }));
  const pageHref = (next: number) => `${path}?status=${status}&page=${next}`;

  return (
    <main className="admin-container space-y-6 py-6 sm:py-8 lg:py-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black sm:text-3xl">گزارش تعهدات و تطبیق کیف پول</h1>
        <ButtonLink href="/reward-policies" variant="outline" size="sm">
          پاداش خرید
        </ButtonLink>
      </header>
      {!report ? (
        <Alert
          tone="danger"
          action={
            <ButtonLink href={pageHref(page)} variant="outline">
              تلاش دوباره
            </ButtonLink>
          }
        >
          دریافت گزارش کیف پول انجام نشد.
        </Alert>
      ) : (
        <>
          {!report.enabled && (
            <Alert tone="warning">پردازش خودکار انقضا و تطبیق غیرفعال است.</Alert>
          )}
          <Card
            title="مانده‌ها بر اساس وضعیت"
            description={`زمان گزارش ${formatAdminDateTime(report.asOf)}`}
          >
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {(Object.keys(walletTotalLabels) as (keyof typeof walletTotalLabels)[]).map((key) => (
                <div
                  key={key}
                  className="space-y-1 border-b border-[var(--admin-color-border)] pb-2"
                >
                  <dt className="text-sm text-[var(--admin-color-muted)]">
                    {walletTotalLabels[key]}
                  </dt>
                  <dd className="font-bold">{formatAdminToman(report.totals[key])}</dd>
                </div>
              ))}
            </dl>
          </Card>
          <Card title="موارد نیازمند پیگیری">
            <nav aria-label="وضعیت موارد تطبیق" className="mb-4 flex flex-wrap gap-2">
              <ButtonLink
                href={path}
                aria-current={status === 'open' ? 'page' : undefined}
                variant={status === 'open' ? 'primary' : 'outline'}
                size="sm"
              >
                باز
              </ButtonLink>
              <ButtonLink
                href={`${path}?status=resolved`}
                aria-current={status === 'resolved' ? 'page' : undefined}
                variant={status === 'resolved' ? 'primary' : 'outline'}
                size="sm"
              >
                تعیین‌تکلیف‌شده
              </ButtonLink>
            </nav>
            {report.issues.length === 0 ? (
              <p className="text-sm text-[var(--admin-color-muted)]">
                در این صفحه موردی ثبت نشده است.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--admin-color-border)]">
                {report.issues.map((issue) => (
                  <li key={`${issue.subject}:${issue.subjectId}`} className="space-y-2 py-3">
                    <p className="font-semibold">{walletIssueLabels[issue.code]}</p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                      <span>شناسایی در {formatAdminDateTime(issue.detectedAt)}</span>
                      {issue.resolvedAt && (
                        <span>تعیین تکلیف در {formatAdminDateTime(issue.resolvedAt)}</span>
                      )}
                      <ButtonLink
                        href={`/reward-policies/wallet-operations?userId=${encodeURIComponent(issue.userId)}`}
                        variant="outline"
                        size="sm"
                      >
                        کیف پول مشتری
                      </ButtonLink>
                      {user.permissions.includes('orders.read') ? (
                        <ButtonLink
                          href={`/orders?orderId=${encodeURIComponent(issue.orderId)}`}
                          variant="outline"
                          size="sm"
                        >
                          سفارش {issue.orderNumber ?? ''}
                        </ButtonLink>
                      ) : (
                        <span>
                          سفارش <bdi>{issue.orderNumber ?? issue.orderId}</bdi>
                        </span>
                      )}
                    </div>
                    <p className="break-all text-xs text-[var(--admin-color-muted)]">
                      {issue.subject === 'LOT' ? 'شناسهٔ بسته' : 'شناسهٔ رزرو'}{' '}
                      <bdi>{issue.subjectId}</bdi>
                    </p>
                  </li>
                ))}
              </ul>
            )}
            {(page > 1 || report.hasMore) && (
              <nav
                aria-label="صفحه‌بندی موارد تطبیق"
                className="mt-4 flex flex-wrap items-center gap-3"
              >
                {page > 1 && (
                  <ButtonLink href={pageHref(page - 1)} variant="outline" size="sm">
                    صفحهٔ قبل
                  </ButtonLink>
                )}
                <span className="text-sm">صفحهٔ {formatAdminInteger(page)}</span>
                {report.hasMore && page < maxPage && (
                  <ButtonLink href={pageHref(page + 1)} variant="outline" size="sm">
                    صفحهٔ بعد
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
