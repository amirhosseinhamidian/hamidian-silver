'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { formatTomanPrice } from '@/lib/catalog/presentation';
import { walletReason, type WalletPreview } from '@/lib/wallet/wallet-presentation';
import { useWalletBalance } from './use-wallet-balance';
import { WalletBalanceView } from './wallet-balance';

export function CartWalletPreview({ request }: Readonly<{ request: string }>) {
  const { state, refresh } = useWalletBalance();
  const [revision, setRevision] = useState(0);
  const [estimate, setEstimate] = useState<{
    request: string;
    revision: number;
    value: WalletPreview | null;
  }>();
  const balance = state.status === 'ready' ? state.balance : null;
  useEffect(() => {
    if (!balance || balance.availableToman === 0) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void fetch('/api/cart/wallet-estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: request,
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok) throw new Error('Wallet estimate unavailable');
          const value = (await response.json()) as WalletPreview;
          if (!Number.isSafeInteger(value.walletAppliedToman)) throw new Error('Invalid estimate');
          if (!controller.signal.aborted) setEstimate({ request, revision, value });
        })
        .catch(() => {
          if (!controller.signal.aborted) setEstimate({ request, revision, value: null });
        });
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [request, balance, revision]);

  if (state.status === 'anonymous') return null;
  const current =
    estimate?.request === request && estimate.revision === revision ? estimate.value : undefined;
  return (
    <section
      aria-label="کیف پول سبد خرید"
      className="my-4 space-y-2 rounded-sm border border-[var(--sf-color-border)] p-4 text-sm lg:col-start-2 lg:row-start-2 lg:mt-0"
    >
      <h2 className="font-bold">اعتبار کیف پول</h2>
      {state.status === 'loading' && <p role="status">در حال دریافت مانده…</p>}
      {balance && <WalletBalanceView balance={balance} />}
      {balance && balance.availableToman === 0 && (
        <p>اعتباری برای استفاده در این سبد در دسترس نیست.</p>
      )}
      {balance && balance.availableToman > 0 && current !== null && (
        <p role="status">
          {current === undefined
            ? 'در حال برآورد اعتبار قابل استفاده…'
            : current.walletAppliedToman > 0
              ? `اعتبار قابل استفاده در این سبد تا ${formatTomanPrice(current.walletAppliedToman)}`
              : walletReason(current.walletUnavailableReason)}
        </p>
      )}
      {balance && balance.availableToman > 0 && (
        <p className="text-xs">
          مبلغ نهایی پس از انتخاب ارسال و اعمال تخفیف در پرداخت مشخص می‌شود.
        </p>
      )}
      {(state.status === 'error' ||
        (balance && balance.availableToman > 0 && current === null)) && (
        <p role="alert">
          دریافت اطلاعات اعتبار انجام نشد.{' '}
          <Button
            variant="text"
            onClick={() => {
              refresh();
              setRevision((value) => value + 1);
            }}
          >
            تلاش دوباره
          </Button>
        </p>
      )}
    </section>
  );
}
