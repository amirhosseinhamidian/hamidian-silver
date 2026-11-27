import { cookies } from 'next/headers';
import { WalletActionForm } from '@/components/reward-policies/wallet-action-form';
import { Alert } from '@/components/ui/alert';
import { ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/form-control';
import { requireAdminSession } from '@/lib/auth/session';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';
import { readJsonResponse, requestAdminCatalog } from '@/lib/catalog/catalog-api';
import {
  formatAdminDateTime,
  formatAdminInteger,
  formatAdminToman,
} from '@/lib/presentation/formatters';
import {
  rewardJobLabels,
  walletOperationsPath,
  walletUuid,
  type AdminWalletBalance,
  type AdminWalletLedger,
  type RewardJobPage,
} from '@/lib/reward-policies/wallet-operations';

export const dynamic = 'force-dynamic';

type Filters = { userId?: string; ledgerPage?: string; jobPage?: string };
const maxPage = 10_000;
const operationLabels = {
  GRANT: 'صدور پاداش',
  ACTIVATE: 'فعال‌سازی',
  RESERVE: 'رزرو',
  RELEASE: 'آزادسازی',
  CAPTURE: 'مصرف اعتبار',
  EXPIRE: 'انقضا',
  REVOKE_GRANT: 'اصلاح پاداش',
  REVERSE_CAPTURE: 'برگشت اعتبار',
};
const bucketLabels = {
  PENDING: 'در انتظار',
  AVAILABLE: 'قابل مصرف',
  RESERVED: 'رزروشده',
  CAPTURED: 'مصرف‌شده',
  EXPIRED: 'منقضی',
  REVOKED: 'لغوشده',
};

async function readAdmin<T>(token: string | undefined, path: string): Promise<T | null> {
  if (!token) return null;
  try {
    const response = await requestAdminCatalog(path, token);
    return response.ok ? ((await readJsonResponse(response)) as T) : null;
  } catch {
    return null;
  }
}

function pageNumber(value: string | undefined) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 1 && number <= maxPage ? number : 1;
}

function PageLinks({
  page,
  hasMore,
  href,
}: Readonly<{
  page: number;
  hasMore: boolean;
  href: (page: number) => string;
}>) {
  if (page === 1 && !hasMore) return null;
  return (
    <nav aria-label="صفحه‌بندی" className="mt-4 flex flex-wrap items-center gap-3">
      {page > 1 && (
        <ButtonLink href={href(page - 1)} size="sm" variant="outline">
          صفحهٔ قبل
        </ButtonLink>
      )}
      <span className="text-sm">صفحهٔ {formatAdminInteger(page)}</span>
      {hasMore && page < maxPage && (
        <ButtonLink href={href(page + 1)} size="sm" variant="outline">
          صفحهٔ بعد
        </ButtonLink>
      )}
    </nav>
  );
}

export default async function WalletOperationsPage({
  searchParams,
}: Readonly<{ searchParams: Promise<Filters> }>) {
  const user = await requireAdminSession({
    permissions: ['finance.read'],
    returnTo: walletOperationsPath,
  });
  const canWrite = user.permissions.includes('finance.write');
  const canReadOrders = user.permissions.includes('orders.read');
  const filters = await searchParams;
  const input = typeof filters.userId === 'string' ? filters.userId.trim().toLowerCase() : '';
  const userId = walletUuid.test(input) ? input : null;
  const ledgerPage = pageNumber(filters.ledgerPage);
  const jobPage = pageNumber(filters.jobPage);
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const root = '/api/v1/wallet/admin';
  const [balance, ledger, jobs] = userId
    ? await Promise.all([
        readAdmin<AdminWalletBalance>(token, `${root}/${userId}`),
        readAdmin<AdminWalletLedger>(token, `${root}/${userId}/ledger?page=${ledgerPage}`),
        readAdmin<RewardJobPage>(
          token,
          `${root}/purchase-reward-jobs/customers/${userId}?page=${jobPage}`,
        ),
      ])
    : [null, null, null];
  const href = (newLedgerPage: number, newJobPage: number) =>
    `${walletOperationsPath}?${new URLSearchParams({ userId: userId ?? '', ledgerPage: String(newLedgerPage), jobPage: String(newJobPage) })}`;

  return (
    <main className="admin-container space-y-6 py-6 sm:py-8 lg:py-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black sm:text-3xl">مدیریت کیف پول مشتری</h1>
        <ButtonLink href="/reward-policies" size="sm" variant="outline">
          پاداش خرید
        </ButtonLink>
      </header>
      <Card title="انتخاب حساب">
        <form action={walletOperationsPath} className="flex flex-wrap items-end gap-3">
          <div className="w-full max-w-sm space-y-1">
            <label htmlFor="wallet-customer" className="text-sm font-semibold">
              شناسهٔ مشتری
            </label>
            <Input
              key={input}
              id="wallet-customer"
              name="userId"
              defaultValue={input}
              maxLength={36}
              dir="ltr"
              required
            />
          </div>
          <button
            type="submit"
            className="min-h-10 rounded px-4 text-sm font-bold text-white bg-[var(--admin-color-primary)]"
          >
            نمایش کیف پول
          </button>
        </form>
        {input && !userId && (
          <p role="alert" className="mt-3 text-sm">
            شناسهٔ مشتری معتبر نیست.
          </p>
        )}
      </Card>
      {userId && (
        <>
          <Card title="ماندهٔ حساب">
            {balance ? (
              <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <dt>قابل مصرف</dt>
                  <dd className="font-bold">{formatAdminToman(balance.availableToman)}</dd>
                </div>
                <div>
                  <dt>در انتظار تأیید</dt>
                  <dd>{formatAdminToman(balance.pendingToman)}</dd>
                </div>
                <div>
                  <dt>رزروشده</dt>
                  <dd>{formatAdminToman(balance.reservedToman)}</dd>
                </div>
                <div>
                  <dt>نزدیک‌ترین سررسید</dt>
                  <dd>
                    {balance.nextExpiryAt
                      ? `${typeof balance.nextExpiryToman === 'number' ? formatAdminToman(balance.nextExpiryToman) : 'مبلغ در دسترس نیست'} · ${formatAdminDateTime(balance.nextExpiryAt)}`
                      : 'سررسید فعالی ثبت نشده است'}
                  </dd>
                </div>
              </dl>
            ) : (
              <Alert tone="danger">دریافت مانده انجام نشد.</Alert>
            )}
          </Card>
          <Card title="وضعیت پردازش پاداش خرید">
            {!jobs ? (
              <Alert tone="danger">دریافت وضعیت پردازش انجام نشد.</Alert>
            ) : jobs.items.length === 0 ? (
              <p className="text-sm">موردی برای این حساب در این صفحه ثبت نشده است.</p>
            ) : (
              <ul className="divide-y divide-[var(--admin-color-border)]">
                {jobs.items.map((job) => (
                  <li key={job.orderId} className="space-y-2 py-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <strong>{rewardJobLabels[job.status]}</strong>
                      {canReadOrders ? (
                        <ButtonLink
                          href={`/orders?orderId=${encodeURIComponent(job.orderId)}`}
                          size="sm"
                          variant="outline"
                        >
                          سفارش {job.orderNumber}
                        </ButtonLink>
                      ) : (
                        <span>سفارش {job.orderNumber}</span>
                      )}
                      {job.resultCode && <bdi className="text-xs">{job.resultCode}</bdi>}
                    </div>
                    {job.reviewHeldAt ? (
                      <p className="text-sm">
                        در قفل بررسی از {formatAdminDateTime(job.reviewHeldAt)}
                      </p>
                    ) : (
                      (job.status === 'WAITING' || job.status === 'PENDING') && (
                        <p className="text-sm">نوبت بعد {formatAdminDateTime(job.nextAttemptAt)}</p>
                      )
                    )}
                    {canWrite &&
                      (job.status === 'PENDING' ||
                        job.status === 'WAITING' ||
                        job.status === 'DEAD_LETTER') && (
                        <WalletActionForm
                          key={String(job.reviewHeldAt)}
                          fieldId={`hold-${job.orderId}`}
                          label={job.reviewHeldAt ? 'برداشتن قفل بررسی' : 'قفل برای بررسی'}
                          action={{ kind: 'review-hold', id: job.orderId, hold: !job.reviewHeldAt }}
                        />
                      )}
                    {canWrite && job.status === 'DEAD_LETTER' && !job.reviewHeldAt && (
                      <WalletActionForm
                        fieldId={`retry-${job.orderId}`}
                        label="تلاش دوبارهٔ پردازش"
                        action={{ kind: 'retry', id: job.orderId }}
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}
            {jobs && (
              <PageLinks
                page={jobPage}
                hasMore={jobs.hasMore}
                href={(next) => href(ledgerPage, next)}
              />
            )}
          </Card>
          <Card title="دفتر تراکنش‌ها">
            {!ledger ? (
              <Alert tone="danger">دریافت دفتر تراکنش‌ها انجام نشد.</Alert>
            ) : ledger.items.length === 0 ? (
              <p className="text-sm">تراکنشی در این صفحه ثبت نشده است.</p>
            ) : (
              <ol className="divide-y divide-[var(--admin-color-border)]">
                {ledger.items.map((entry) => (
                  <li key={entry.id} className="space-y-2 py-3">
                    <div className="flex flex-wrap gap-3">
                      <strong>{operationLabels[entry.kind]}</strong>
                      <time dateTime={entry.recordedAt} className="text-sm">
                        {formatAdminDateTime(entry.recordedAt)}
                      </time>
                    </div>
                    {entry.reason && <p className="text-sm">دلیل اصلاح {entry.reason}</p>}
                    {entry.actorUserId && (
                      <p className="break-all text-xs">
                        شناسهٔ ثبت‌کننده <bdi>{entry.actorUserId}</bdi>
                      </p>
                    )}
                    {entry.movements.map((movement, index) => {
                      const correction =
                        entry.kind === 'GRANT'
                          ? 'REVOKE_GRANT'
                          : entry.kind === 'CAPTURE'
                            ? 'REVERSE_CAPTURE'
                            : null;
                      const targetId =
                        correction === 'REVOKE_GRANT' ? movement.lotId : movement.reservationId;
                      return (
                        <div
                          key={`${movement.lotId}-${index}`}
                          className="space-y-2 rounded border border-[var(--admin-color-border)] p-3 text-sm"
                        >
                          <p>
                            {formatAdminToman(movement.amountToman)} ·{' '}
                            {movement.source === 'PURCHASE' ? 'پاداش خرید' : 'پاداش معرفی'} ·{' '}
                            {bucketLabels[movement.toBucket]}
                            {movement.fromBucket && ` از ${bucketLabels[movement.fromBucket]}`}
                          </p>
                          <p className="text-xs">
                            سررسید {formatAdminDateTime(movement.expiresAt)} · نسخه{' '}
                            {formatAdminInteger(movement.policyVersion)}
                          </p>
                          <p className="break-all text-xs">
                            شناسهٔ بسته <bdi>{movement.lotId}</bdi>
                          </p>
                          {canWrite &&
                            correction &&
                            targetId &&
                            (correction === 'REVOKE_GRANT' || index === 0) && (
                              <WalletActionForm
                                fieldId={`correction-${entry.id}-${index}`}
                                label={
                                  correction === 'REVOKE_GRANT'
                                    ? 'کسر از پاداش'
                                    : 'برگشت اعتبار مصرف‌شده'
                                }
                                action={{ kind: 'corrections', id: userId, targetId, correction }}
                              />
                            )}
                        </div>
                      );
                    })}
                  </li>
                ))}
              </ol>
            )}
            {ledger && (
              <PageLinks
                page={ledgerPage}
                hasMore={ledger.hasMore}
                href={(next) => href(next, jobPage)}
              />
            )}
          </Card>
        </>
      )}
    </main>
  );
}
