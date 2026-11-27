'use client';

import { useEffect, useId, useState } from 'react';
import type { components } from '@hamidian/contracts';
import type { CustomerOrder } from '@/components/account/account-types';
import { Button, ButtonLink } from '@/components/ui/button';
import type { useWalletBalance } from '@/components/wallet/use-wallet-balance';
import { WalletBalanceView } from '@/components/wallet/wallet-balance';
import { WalletNotifications } from '@/components/wallet/wallet-notifications';
import { AUTHENTICATION_ENDED_EVENT } from '@/lib/auth/events';
import { formatTomanPrice } from '@/lib/catalog/presentation';
import {
  referralPath,
  referralRewardLabels,
  type ReferralOverview,
} from '@/lib/referrals/presentation';
import { formatWalletDate } from '@/lib/wallet/wallet-presentation';

const card = 'min-w-0 space-y-3 rounded-sm border border-[var(--sf-color-border)] p-4 sm:p-5';
type Source = components['schemas']['WalletSourceBalanceDto'];
type ReferralState =
  { status: 'loading' | 'error' | 'anonymous' } | { status: 'ready'; data: ReferralOverview };

function CreditSource({ balance }: { balance: Source }) {
  const title = useId();
  return (
    <section aria-labelledby={title} className={card}>
      <h3 id={title} className="font-bold">
        {balance.source === 'PURCHASE' ? 'پاداش خرید' : 'پاداش معرفی'}
      </h3>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm leading-6">
        <dt>قابل مصرف</dt>
        <dd className="font-semibold">{formatTomanPrice(balance.availableToman)}</dd>
        <dt>در انتظار تأیید</dt>
        <dd>{formatTomanPrice(balance.pendingToman)}</dd>
        <dt>رزروشده</dt>
        <dd>{formatTomanPrice(balance.reservedToman)}</dd>
        <dt>منقضی‌شده</dt>
        <dd>{formatTomanPrice(balance.expiredToman)}</dd>
      </dl>
    </section>
  );
}

export function LoyaltyPanel({
  wallet,
  orders,
  openWallet,
}: {
  wallet: ReturnType<typeof useWalletBalance>;
  orders: readonly CustomerOrder[];
  openWallet: () => void;
}) {
  const [referrals, setReferrals] = useState<ReferralState>({ status: 'loading' });
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let pending: AbortController | undefined;
    function load() {
      pending?.abort();
      const controller = new AbortController();
      pending = controller;
      void fetch('/api/referrals?page=1', { cache: 'no-store', signal: controller.signal })
        .then(async (response) => {
          if (controller.signal.aborted) return;
          if (response.status === 401) {
            setReferrals({ status: 'anonymous' });
            return;
          }
          if (!response.ok) throw new Error('Referral overview unavailable.');
          const data = (await response.json()) as ReferralOverview;
          if (!Array.isArray(data.outgoing?.items)) throw new Error('Invalid referral overview.');
          if (!controller.signal.aborted) setReferrals({ status: 'ready', data });
        })
        .catch(() => {
          if (!controller.signal.aborted) setReferrals({ status: 'error' });
        });
    }
    function signOut() {
      pending?.abort();
      setReferrals({ status: 'anonymous' });
    }
    function onPageShow(event: PageTransitionEvent) {
      if (event.persisted) load();
    }
    load();
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener(AUTHENTICATION_ENDED_EVENT, signOut);
    return () => {
      pending?.abort();
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener(AUTHENTICATION_ENDED_EVENT, signOut);
    };
  }, [refreshKey]);

  const failedPayment = orders.find(
    ({ status, payment }) =>
      status === 'PENDING_PAYMENT' &&
      (payment?.latestAttemptFailed ||
        payment?.rejectionReason ||
        payment?.status === 'RECONCILIATION_REQUIRED'),
  );
  const referral = referrals.status === 'ready' ? referrals.data : null;
  if (wallet.state.status === 'anonymous' || referrals.status === 'anonymous')
    return <p role="status">برای مشاهدهٔ باشگاه دوباره وارد شوید.</p>;

  return (
    <section aria-labelledby="loyalty-title" className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="loyalty-title" className="text-2xl font-bold">
          باشگاه مشتریان
        </h2>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            wallet.refresh();
            setRefreshKey((value) => value + 1);
          }}
        >
          به‌روزرسانی باشگاه
        </Button>
      </header>
      <div className={card}>
        {wallet.state.status === 'ready' && (
          <>
            <WalletBalanceView balance={wallet.state.balance} showNextExpiry={false} />
            {wallet.state.balance.availableToman === 0 && (
              <p className="text-sm">فعلاً اعتبار قابل مصرف ندارید.</p>
            )}
            <WalletNotifications refreshKey={refreshKey} reminderOnly />
          </>
        )}
        {wallet.state.status === 'loading' && <p role="status">در حال دریافت ماندهٔ اعتبار…</p>}
        {wallet.state.status === 'error' && <p role="alert">دریافت ماندهٔ اعتبار انجام نشد.</p>}
        <Button size="sm" variant="text" onClick={openWallet}>
          تاریخچه و تنظیمات کیف پول
        </Button>
      </div>
      {wallet.state.status === 'ready' && wallet.state.balance.sourceBalances && (
        <div className="grid gap-3 sm:grid-cols-2">
          {wallet.state.balance.sourceBalances.map((balance) => (
            <CreditSource key={balance.source} balance={balance} />
          ))}
        </div>
      )}
      {failedPayment && (
        <aside aria-labelledby="loyalty-payment" className={card}>
          <h3 id="loyalty-payment" className="font-bold">
            پیگیری پرداخت
          </h3>
          <p className="text-sm">
            {failedPayment.payment?.status === 'RECONCILIATION_REQUIRED'
              ? 'نتیجهٔ پرداخت در حال بررسی است. وضعیت سفارش را پیش از پرداخت دوباره ببینید.'
              : failedPayment.payment?.method === 'CARD_TO_CARD'
                ? 'رسید پرداخت تأیید نشده است. وضعیت سفارش و اعتبار رزروشده را بررسی کنید.'
                : 'تلاش قبلی پرداخت ناموفق بود. وضعیت سفارش و اعتبار را بررسی کنید.'}
          </p>
          <ButtonLink
            size="sm"
            variant="text"
            href={`/account/orders/${encodeURIComponent(failedPayment.id)}`}
          >
            مشاهدهٔ وضعیت سفارش
          </ButtonLink>
        </aside>
      )}
      <section aria-labelledby="loyalty-referrals" className={card}>
        <h3 id="loyalty-referrals" className="font-bold">
          معرفی دوستان
        </h3>
        {referrals.status === 'loading' && <p role="status">در حال دریافت معرفی‌ها…</p>}
        {referrals.status === 'error' && <p role="alert">دریافت وضعیت معرفی انجام نشد.</p>}
        {referral && (
          <>
            {referral.code && (
              <p className="text-sm">
                کد معرفی شما{' '}
                <bdi className="break-all font-semibold" dir="ltr">
                  {referral.code}
                </bdi>
              </p>
            )}
            {!referral.enabled && <p className="text-sm">معرفی جدید فعلاً غیرفعال است.</p>}
            {referral.enabled && !referral.referrerEligible && (
              <p className="text-sm">
                برای دریافت کد، ابتدا یک سفارش پرداخت‌شده و تحویل‌گرفته‌شده داشته باشید.
              </p>
            )}
            {referral.enabled && referral.referrerEligible && !referral.code && (
              <p className="text-sm">کد اختصاصی خود را از بخش معرفی دوستان دریافت کنید.</p>
            )}
            {referral.outgoing.items.length ? (
              <ul className="divide-y divide-[var(--sf-color-border)] text-sm">
                {referral.outgoing.items.slice(0, 3).map((item) => (
                  <li key={item.id} className="space-y-1 py-2">
                    <p>
                      {item.rewardStatus
                        ? referralRewardLabels[item.rewardStatus]
                        : item.status === 'FIRST_PURCHASE_CONFIRMED'
                          ? referralRewardLabels.PENDING
                          : item.status === 'EXPIRED'
                            ? referralRewardLabels.EXPIRED
                            : referralRewardLabels.AWAITING_PURCHASE}
                    </p>
                    <p>
                      ثبت معرفی در{' '}
                      <time dateTime={item.claimedAt}>{formatWalletDate(item.claimedAt)}</time>
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm">هنوز معرفی‌ای از طرف شما ثبت نشده است.</p>
            )}
          </>
        )}
        <ButtonLink size="sm" variant="text" href={referralPath}>
          کد و تاریخچهٔ معرفی‌ها
        </ButtonLink>
      </section>
      <section aria-labelledby="loyalty-benefits" className={card}>
        <h3 id="loyalty-benefits" className="font-bold">
          مزایا و شرایط استفاده
        </h3>
        <ul className="list-disc space-y-2 ps-5 text-sm leading-7">
          <li>
            پاداش خرید طبق قانون همان سفارش و پس از احراز شرایط تحویل و مرجوعی قابل مصرف می‌شود.
          </li>
          <li>
            پاداش معرف پس از خرید اول واجد شرایط دوست و تأیید آن صادر می‌شود. اعتبار دوست در صورت
            احراز شرایط، در پرداخت خرید اول اعمال می‌شود.
          </li>
          <li>
            مبلغ قابل استفاده در هر سفارش به شرایط کالا و سقف مصرف بستگی دارد و در مرحلهٔ پرداخت
            محاسبه می‌شود.
          </li>
        </ul>
        <ButtonLink size="sm" variant="text" href="/gift-finder">
          انتخاب هدیه براساس مناسبت و بودجه
        </ButtonLink>
      </section>
    </section>
  );
}
