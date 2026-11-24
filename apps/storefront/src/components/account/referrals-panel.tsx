'use client';

import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from 'react';
import { Button, ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/form-control';
import {
  AUTHENTICATION_ENDED_EVENT,
  AUTHENTICATION_SUCCEEDED_EVENT,
  openAuthModal,
} from '@/lib/auth/events';
import {
  referralCodeFromHash,
  referralCodePattern,
  referralError,
  referralLink,
  type ReceivedReferral,
  type ReferralHistoryItem,
  type ReferralOverview,
} from '@/lib/referrals/presentation';
import { formatWalletDate } from '@/lib/wallet/wallet-presentation';

type View =
  { status: 'idle' | 'anonymous' | 'error' } | { status: 'ready'; data: ReferralOverview };
const statuses: Record<ReferralHistoryItem['status'], string> = {
  PENDING: 'در انتظار اولین پرداخت قطعی',
  FIRST_PURCHASE_CONFIRMED: 'اولین پرداخت تأیید شد',
  EXPIRED: 'مهلت معرفی پایان یافته است',
};
const persianNumber = new Intl.NumberFormat('fa-IR');
const sectionClass =
  'min-w-0 space-y-4 rounded-sm border border-[var(--sf-color-border)] p-4 sm:p-5';

function subscribeToReferralLink(callback: () => void) {
  window.addEventListener('hashchange', callback);
  return () => window.removeEventListener('hashchange', callback);
}

function referralFromLocation() {
  return referralCodeFromHash(window.location.hash);
}

function ReferralRecord({ item }: Readonly<{ item: ReferralHistoryItem }>) {
  return (
    <div className="space-y-1 text-sm leading-6">
      <p className="font-semibold">{statuses[item.status]}</p>
      <p>
        ثبت‌شده در <time dateTime={item.claimedAt}>{formatWalletDate(item.claimedAt)}</time>
      </p>
      {item.status === 'PENDING' && (
        <p>
          مهلت تا <time dateTime={item.expiresAt}>{formatWalletDate(item.expiresAt)}</time>
        </p>
      )}
      {item.firstPaidAt && (
        <p>
          زمان پرداخت <time dateTime={item.firstPaidAt}>{formatWalletDate(item.firstPaidAt)}</time>
        </p>
      )}
    </div>
  );
}

export function ReferralsPanel() {
  const linkedCode = useSyncExternalStore(subscribeToReferralLink, referralFromLocation, () => '');
  const [input, setInput] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [view, setView] = useState<View>({ status: 'idle' });
  const [busy, setBusy] = useState<'code' | 'claim' | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const write = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/referrals?page=${page}`, { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        if (controller.signal.aborted) return;
        if (response.status === 401) {
          setView({ status: 'anonymous' });
          return;
        }
        if (!response.ok) throw new Error('Referral overview unavailable');
        const data = (await response.json()) as ReferralOverview;
        if (typeof data.enabled !== 'boolean' || !Array.isArray(data.outgoing?.items)) {
          throw new Error('Invalid referral overview');
        }
        if (!controller.signal.aborted) setView({ status: 'ready', data });
      })
      .catch(() => {
        if (!controller.signal.aborted) setView({ status: 'error' });
      });
    function signOut() {
      controller.abort();
      write.current?.abort();
      write.current = null;
      setView({ status: 'anonymous' });
      setBusy(null);
      setPage(1);
      setInput(null);
      setError('');
      setNotice('');
    }
    function signIn() {
      setView({ status: 'idle' });
      setRevision((value) => value + 1);
    }
    window.addEventListener(AUTHENTICATION_SUCCEEDED_EVENT, signIn);
    window.addEventListener(AUTHENTICATION_ENDED_EVENT, signOut);
    return () => {
      controller.abort();
      window.removeEventListener(AUTHENTICATION_SUCCEEDED_EVENT, signIn);
      window.removeEventListener(AUTHENTICATION_ENDED_EVENT, signOut);
    };
  }, [page, revision]);

  useEffect(() => () => write.current?.abort(), []);

  async function submit(action: 'code' | 'claim', code?: string) {
    if (write.current) return;
    if (action === 'claim' && (!code || !referralCodePattern.test(code))) {
      setError('کد معرفی را کامل و بدون فاصله وارد کنید.');
      return;
    }
    const controller = new AbortController();
    write.current = controller;
    setBusy(action);
    setError('');
    setNotice('');
    try {
      const response = await fetch(`/api/referrals/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(code ? { code } : {}),
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      if (response.status === 401) {
        setView({ status: 'anonymous' });
        return;
      }
      if (!response.ok) {
        const message = await referralError(response);
        if (!controller.signal.aborted) setError(message);
        return;
      }
      if (action === 'code') {
        const data = (await response.json()) as { code: string };
        if (controller.signal.aborted) return;
        if (!referralCodePattern.test(data.code)) throw new Error('Invalid issued code');
        setView((current) =>
          current.status === 'ready'
            ? { status: 'ready', data: { ...current.data, code: data.code } }
            : current,
        );
      } else {
        const incoming = (await response.json()) as ReceivedReferral;
        if (controller.signal.aborted) return;
        setView((current) =>
          current.status === 'ready'
            ? { status: 'ready', data: { ...current.data, incoming } }
            : current,
        );
        setInput('');
        if (linkedCode)
          window.history.replaceState(
            window.history.state,
            '',
            window.location.pathname + window.location.search,
          );
        setNotice('کد معرفی ثبت شد.');
      }
    } catch {
      if (!controller.signal.aborted)
        setError('ارتباط با سرویس معرفی برقرار نشد. دوباره تلاش کنید.');
    } finally {
      if (write.current === controller) {
        write.current = null;
        if (!controller.signal.aborted) setBusy(null);
      }
    }
  }

  async function copyLink(code: string) {
    setError('');
    try {
      await navigator.clipboard.writeText(new URL(referralLink(code), window.location.origin).href);
      setNotice('لینک معرفی کپی شد.');
    } catch {
      setError('کپی خودکار انجام نشد. کد معرفی را از کادر انتخاب و کپی کنید.');
    }
  }

  if (view.status === 'idle')
    return (
      <p role="status" className="py-8">
        در حال دریافت معرفی‌ها…
      </p>
    );
  if (view.status === 'anonymous') {
    return (
      <EmptyState
        title="برای ثبت یا مشاهدهٔ معرفی وارد شوید"
        action={<Button onClick={openAuthModal}>ورود یا ثبت‌نام</Button>}
      />
    );
  }
  if (view.status !== 'ready') {
    return (
      <EmptyState
        title="دریافت اطلاعات معرفی انجام نشد"
        action={
          <Button
            onClick={() => {
              setView({ status: 'idle' });
              setRevision((value) => value + 1);
            }}
          >
            تلاش دوباره
          </Button>
        }
      />
    );
  }
  const { data } = view;
  const ownCode = data.code;
  const available = data.enabled;
  const claim = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submit('claim', (input ?? linkedCode).trim());
  };

  return (
    <div className="space-y-6 py-8">
      {!available && (
        <p role="status" className="text-sm">
          دریافت کد و ثبت معرفی در حال حاضر غیرفعال است.
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-sm border border-[var(--sf-color-border)] p-3 text-sm">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm">
          {notice}
        </p>
      )}
      <div className="grid items-start gap-4 md:grid-cols-2">
        <section className={sectionClass} aria-labelledby="own-referral">
          <h2 id="own-referral" className="text-lg font-bold">
            کد معرفی من
          </h2>
          <p className="text-sm">
            برای معرفی دوستان باید دست‌کم یک سفارش پرداخت‌شده و تحویل‌گرفته‌شده داشته باشید. شرط
            دریافت پاداش معرف، تکمیل خرید اول دوست و تأیید شرایط آن است.
          </p>
          {ownCode ? (
            <>
              <label htmlFor="my-referral-code" className="block text-sm">
                کد اختصاصی
              </label>
              <Input id="my-referral-code" dir="ltr" readOnly value={ownCode} />
              {available && (
                <Button variant="outline" onClick={() => void copyLink(ownCode)}>
                  کپی لینک معرفی
                </Button>
              )}
            </>
          ) : (
            available &&
            data.referrerEligible && (
              <Button
                loading={busy === 'code'}
                disabled={Boolean(busy)}
                onClick={() => void submit('code')}
              >
                دریافت کد معرفی
              </Button>
            )
          )}
          {!available && !ownCode && (
            <p className="text-sm">هنوز کدی برای این حساب صادر نشده است.</p>
          )}
          {available && !data.referrerEligible && (
            <ButtonLink href="/account" variant="text">
              مشاهدهٔ سفارش‌های من
            </ButtonLink>
          )}
        </section>
        <section className={sectionClass} aria-labelledby="received-referral">
          <h2 id="received-referral" className="text-lg font-bold">
            معرفی ثبت‌شده برای من
          </h2>
          {data.incoming ? (
            <>
              <ReferralRecord item={data.incoming} />
              {data.incoming.firstOrderId && (
                <ButtonLink
                  variant="text"
                  href={`/account/orders/${encodeURIComponent(data.incoming.firstOrderId)}`}
                >
                  مشاهدهٔ اولین سفارش
                </ButtonLink>
              )}
            </>
          ) : available ? (
            <form onSubmit={claim} className="space-y-3">
              <p className="text-sm">
                کد را پیش از اولین پرداخت قطعی ثبت کنید. مهلت خرید پس از ثبت کد{' '}
                {persianNumber.format(data.attributionDays)} روز است.
              </p>
              <p className="text-sm">
                اعتبار خرید اول در صورت احراز شرایط، هنگام پرداخت همان سفارش اعمال می‌شود.
              </p>
              <label htmlFor="received-referral-code" className="block text-sm">
                کد دوست
              </label>
              <Input
                id="received-referral-code"
                dir="ltr"
                maxLength={24}
                autoComplete="off"
                value={input ?? linkedCode}
                onChange={(event) => setInput(event.currentTarget.value)}
                required
              />
              <Button type="submit" loading={busy === 'claim'} disabled={Boolean(busy)}>
                ثبت کد معرفی
              </Button>
            </form>
          ) : (
            <p className="text-sm">معرفی‌ای برای این حساب ثبت نشده است.</p>
          )}
        </section>
      </div>
      <section
        className={sectionClass}
        aria-labelledby="referral-history"
        aria-busy={data.outgoing.page !== page}
      >
        <h2 id="referral-history" className="text-lg font-bold">
          تاریخچهٔ معرفی دوستان
        </h2>
        {data.outgoing.page !== page ? (
          <p role="status">در حال دریافت تاریخچه…</p>
        ) : (
          <>
            {data.outgoing.items.length ? (
              <ol className="divide-y divide-[var(--sf-color-border)]">
                {data.outgoing.items.map((item) => (
                  <li key={item.id} className="py-3">
                    <ReferralRecord item={item} />
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm">در این صفحه معرفی‌ای ثبت نشده است.</p>
            )}
            {(page > 1 || data.outgoing.hasMore) && (
              <nav aria-label="صفحه‌بندی معرفی‌ها" className="flex flex-wrap items-center gap-3">
                {page > 1 && (
                  <Button
                    variant="outline"
                    disabled={Boolean(busy)}
                    onClick={() => setPage(page - 1)}
                  >
                    صفحهٔ قبل
                  </Button>
                )}
                <span className="text-sm">صفحهٔ {persianNumber.format(page)}</span>
                {data.outgoing.hasMore && page < 10_000 && (
                  <Button
                    variant="outline"
                    disabled={Boolean(busy)}
                    onClick={() => setPage(page + 1)}
                  >
                    صفحهٔ بعد
                  </Button>
                )}
              </nav>
            )}
          </>
        )}
      </section>
    </div>
  );
}
