'use client';

import { useEffect, useState } from 'react';
import type { components } from '@hamidian/contracts';
import { Button, ButtonLink } from '@/components/ui/button';
import { formatTomanPrice } from '@/lib/catalog/presentation';
import { formatWalletDate } from '@/lib/wallet/wallet-presentation';
import type { useWalletBalance } from './use-wallet-balance';
import { WalletBalanceView } from './wallet-balance';
import { WalletNotifications } from './wallet-notifications';

type WalletOperation = Pick<
  components['schemas']['WalletOperationDto'],
  'id' | 'kind' | 'recordedAt'
> & {
  movements: Array<
    Pick<
      components['schemas']['WalletMovementDto'],
      'lotId' | 'source' | 'expiresAt' | 'reservationOrderId' | 'amountToman' | 'toBucket'
    > & { originOrderId: string | null }
  >;
};
type History = { items: WalletOperation[]; hasMore: boolean };

const operationLabels = {
  GRANT: 'صدور پاداش',
  ACTIVATE: 'فعال‌سازی پاداش',
  RESERVE: 'رزرو برای پرداخت',
  RELEASE: 'آزادسازی رزرو',
  CAPTURE: 'مصرف اعتبار',
  EXPIRE: 'انقضا',
  REVOKE_GRANT: 'اصلاح پاداش',
  REVERSE_CAPTURE: 'برگشت اعتبار مصرف‌شده',
};
const bucketLabels = {
  PENDING: 'در انتظار تأیید',
  AVAILABLE: 'قابل مصرف',
  RESERVED: 'رزروشده',
  CAPTURED: 'مصرف‌شده',
  EXPIRED: 'منقضی',
  REVOKED: 'لغوشده',
};

export function AccountWalletPanel({
  wallet,
}: Readonly<{ wallet: ReturnType<typeof useWalletBalance> }>) {
  const { state, refresh } = wallet;
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const [history, setHistory] = useState<{ page: number; attempt: number; data: History | null }>();
  const authorized = state.status !== 'anonymous';
  useEffect(() => {
    if (!authorized) return;
    const controller = new AbortController();
    void fetch(`/api/wallet/ledger?page=${page}`, { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Wallet history unavailable');
        const data = (await response.json()) as History;
        if (!Array.isArray(data.items)) throw new Error('Invalid wallet history');
        if (!controller.signal.aborted) setHistory({ page, attempt, data });
      })
      .catch(() => {
        if (!controller.signal.aborted) setHistory({ page, attempt, data: null });
      });
    return () => controller.abort();
  }, [page, attempt, authorized]);

  const entries = history?.page === page && history.attempt === attempt ? history.data : undefined;
  return (
    <section aria-labelledby="wallet-heading" className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="wallet-heading" className="text-2xl font-bold">
          کیف پول
        </h2>
        {authorized && (
          <Button
            variant="outline"
            onClick={() => {
              refresh();
              setAttempt((value) => value + 1);
            }}
          >
            به‌روزرسانی کیف پول
          </Button>
        )}
      </header>
      {state.status === 'anonymous' ? (
        <p role="status">برای مشاهدهٔ کیف پول دوباره وارد شوید.</p>
      ) : (
        <>
          <div className="rounded-sm border border-[var(--sf-color-border)] p-4">
            {state.status === 'ready' && <WalletBalanceView balance={state.balance} />}
            {state.status === 'loading' && <p role="status">در حال دریافت ماندهٔ کیف پول…</p>}
            {state.status === 'error' && (
              <p role="alert">دریافت مانده انجام نشد. دوباره تلاش کنید.</p>
            )}
          </div>
          <WalletNotifications refreshKey={attempt} />
          <section aria-labelledby="wallet-history-heading">
            <h3 id="wallet-history-heading" className="text-lg font-bold">
              تاریخچهٔ اعتبار
            </h3>
            {entries === undefined && <p role="status">در حال دریافت تاریخچه…</p>}
            {entries === null && <p role="alert">دریافت تاریخچه انجام نشد. دوباره تلاش کنید.</p>}
            {entries &&
              (entries.items.length ? (
                <ol className="divide-y divide-[var(--sf-color-border)]">
                  {entries.items.map((operation) => (
                    <li key={operation.id} className="space-y-2 py-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h4 className="font-semibold">{operationLabels[operation.kind]}</h4>
                        <time className="text-xs" dateTime={operation.recordedAt}>
                          {formatWalletDate(operation.recordedAt)}
                        </time>
                      </div>
                      {operation.movements.map((entry, index) => (
                        <div
                          key={`${entry.lotId}-${index}`}
                          className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm"
                        >
                          <strong>{formatTomanPrice(entry.amountToman)}</strong>
                          <span>{bucketLabels[entry.toBucket]}</span>
                          <span>{entry.source === 'PURCHASE' ? 'پاداش خرید' : 'پاداش معرفی'}</span>
                          {(entry.reservationOrderId || entry.originOrderId) && (
                            <ButtonLink
                              variant="text"
                              href={`/account/orders/${entry.reservationOrderId ?? entry.originOrderId}`}
                            >
                              مشاهدهٔ سفارش
                            </ButtonLink>
                          )}
                        </div>
                      ))}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-3 text-sm">تراکنشی در این صفحه ثبت نشده است.</p>
              ))}
            <nav aria-label="صفحه‌بندی تاریخچهٔ کیف پول" className="mt-3 flex flex-wrap gap-3">
              {page > 1 && (
                <Button variant="outline" onClick={() => setPage(page - 1)}>
                  صفحهٔ قبل
                </Button>
              )}
              {entries?.hasMore && page < 10_000 && (
                <Button variant="outline" onClick={() => setPage(page + 1)}>
                  صفحهٔ بعد
                </Button>
              )}
            </nav>
          </section>
        </>
      )}
    </section>
  );
}
