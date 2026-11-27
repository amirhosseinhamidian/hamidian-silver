'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Button, ButtonLink } from '@/components/ui/button';
import {
  AUTHENTICATION_ENDED_EVENT,
  AUTHENTICATION_SUCCEEDED_EVENT,
  openAuthModal,
} from '@/lib/auth/events';
import {
  cartRecoveryAction,
  cartRecoveryUrl,
  type SavedCartReview,
  type SavedCartStatus,
} from '@/lib/cart/cart-recovery';
import type { CartItem } from '@/lib/cart/cart-state';
import { restoreCart } from '@/lib/cart/cart-store';
import { formatTomanPrice } from '@/lib/catalog/presentation';
import { cn } from '@/lib/ui/cn';

const numbers = new Intl.NumberFormat('fa-IR');
type Action = 'save' | 'preview' | 'restore' | 'hide' | 'discard';

export function CartRecoveryPanel({
  items,
  className,
}: {
  items?: readonly CartItem[];
  className?: string;
}) {
  const title = useId();
  const [status, setStatus] = useState<SavedCartStatus | null>(null);
  const [guest, setGuest] = useState(false);
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [review, setReview] = useState<SavedCartReview | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const operation = useRef<AbortController | null>(null);

  useEffect(() => () => operation.current?.abort(), []);

  useEffect(() => {
    const controller = new AbortController();
    const refresh = () => setReload((value) => value + 1);
    function signedOut() {
      controller.abort();
      operation.current?.abort();
      setStatus(null);
      setGuest(true);
      setReview(null);
      setBusy(false);
      setMessage(null);
      setError(null);
    }
    void fetch(cartRecoveryUrl, { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const next = response.ok ? ((await response.json()) as SavedCartStatus) : null;
        if (!controller.signal.aborted) {
          setGuest(response.status === 401);
          setStatus(next);
        }
      })
      .catch(() => undefined);
    window.addEventListener(AUTHENTICATION_SUCCEEDED_EVENT, refresh);
    window.addEventListener(AUTHENTICATION_ENDED_EVENT, signedOut);
    return () => {
      controller.abort();
      window.removeEventListener(AUTHENTICATION_SUCCEEDED_EVENT, refresh);
      window.removeEventListener(AUTHENTICATION_ENDED_EVENT, signedOut);
    };
  }, [reload]);

  async function perform(action: Action) {
    if (busy || operation.current) return;
    if (guest) {
      openAuthModal();
      return;
    }
    const current = status?.current;
    if (action !== 'save' && !current) return;
    const controller = new AbortController();
    operation.current = controller;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response =
        action === 'save'
          ? await fetch(cartRecoveryUrl, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                current: current ?? undefined,
                items: items?.map(({ variantId, quantity, platingType }) => ({
                  variantId,
                  quantity,
                  ...(platingType ? { platingType } : {}),
                })),
              }),
              signal: controller.signal,
            })
          : await cartRecoveryAction(
              action,
              {
                ...current!,
                ...(action === 'restore' && review ? { reviewKey: review.reviewKey } : {}),
              },
              controller.signal,
            );
      if (controller.signal.aborted) return;
      if (response.status === 401 || response.status === 409) {
        setReview(null);
        setError('نشست یا وضعیت سبد تغییر کرده است. دوباره وضعیت آن را بررسی کنید.');
        setReload((value) => value + 1);
        return;
      }
      if (!response.ok) throw new Error('Cart recovery request failed.');
      if (action === 'preview' || action === 'restore') {
        const next = (await response.json()) as SavedCartReview;
        if (controller.signal.aborted) return;
        if (action === 'restore' && next.applied && current) {
          restoreCart(
            next.lines.flatMap(({ item }) =>
              item ? [{ ...item, media: null, unitCompareAtPriceToman: null }] : [],
            ),
            current,
          );
          setReview(null);
          setMessage('سبد با قیمت و موجودی فعلی بازیابی شد.');
          setReload((value) => value + 1);
        } else {
          setReview(next);
          if (action === 'restore')
            setError('قیمت یا موجودی دوباره تغییر کرد. موارد به‌روز را بررسی کنید.');
        }
      } else {
        const next = (await response.json()) as SavedCartStatus;
        if (controller.signal.aborted) return;
        setStatus(next);
        setReview(null);
        setConfirmDiscard(false);
        if (action === 'save') setMessage('سبد در حساب شما ذخیره شد.');
        if (action === 'discard') setMessage('سبد ذخیره‌شده حذف شد.');
      }
    } catch {
      if (!controller.signal.aborted) setError('عملیات سبد ذخیره‌شده انجام نشد. دوباره تلاش کنید.');
    } finally {
      operation.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  if (!items && !status?.showReminder) return null;
  const canSave = Boolean(items?.length && (status || guest));
  if (items && !canSave && !status?.current && !message && !error) return null;

  return (
    <section
      aria-labelledby={title}
      className={cn(
        'my-6 space-y-3 rounded-lg border border-[var(--sf-color-border)] p-4 sm:p-5',
        className,
      )}
    >
      <h2 id={title} className="font-semibold">
        {items ? 'سبد ذخیره‌شده' : 'خرید نیمه‌کاره'}
      </h2>
      {!items ? (
        <>
          <p className="text-sm">
            {numbers.format(status?.itemCount ?? 0)} کالا در سبد ذخیره‌شدهٔ شماست.
          </p>
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/cart" size="sm">
              بررسی سبد ذخیره‌شده
            </ButtonLink>
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => void perform('hide')}>
              پنهان کردن یادآوری
            </Button>
          </div>
        </>
      ) : (
        <div className="flex flex-wrap gap-2">
          {canSave && (
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => void perform('save')}
            >
              {guest
                ? 'ورود برای ذخیرهٔ سبد'
                : status?.current
                  ? 'جایگزینی سبد ذخیره‌شده با سبد فعلی'
                  : 'ذخیرهٔ سبد در حساب'}
            </Button>
          )}
          {status?.current && (
            <>
              <Button size="sm" disabled={busy} onClick={() => void perform('preview')}>
                بررسی سبد ذخیره‌شده
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => {
                  if (confirmDiscard) void perform('discard');
                  else setConfirmDiscard(true);
                }}
              >
                {confirmDiscard ? 'تأیید حذف سبد ذخیره‌شده' : 'حذف سبد ذخیره‌شده'}
              </Button>
              {confirmDiscard && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => setConfirmDiscard(false)}
                >
                  انصراف
                </Button>
              )}
            </>
          )}
        </div>
      )}
      {busy && (
        <p role="status" className="text-sm">
          در حال بررسی سبد…
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
      {review && (
        <>
          <ul className="divide-y divide-[var(--sf-color-border)] text-sm">
            {review.lines.map(
              ({ item, productName, previousQuantity, previousUnitToman }, index) => {
                const unitToman = item
                  ? item.unitSalePriceToman + item.unitPlatingPriceToman
                  : null;
                return (
                  <li key={index} className="space-y-1 py-2">
                    <strong>
                      {productName}
                      {item ? ` · ${item.variantLabel}` : ''}
                    </strong>
                    {item && unitToman !== null ? (
                      <p>
                        {numbers.format(item.quantity)} عدد · {formatTomanPrice(unitToman)} برای هر
                        واحد
                        {item.quantity !== previousQuantity &&
                          ` · تعداد قبلی ${numbers.format(previousQuantity)}`}
                        {unitToman !== previousUnitToman &&
                          ` · قیمت قبلی ${formatTomanPrice(previousUnitToman)}`}
                      </p>
                    ) : (
                      <p>این گزینه دیگر قابل خرید نیست و به سبد اضافه نمی‌شود.</p>
                    )}
                  </li>
                );
              },
            )}
          </ul>
          <div className="flex flex-wrap gap-2">
            {review.lines.some(({ item }) => item) && (
              <Button size="sm" disabled={busy} onClick={() => void perform('restore')}>
                {items?.length ? 'تأیید و جایگزینی سبد فعلی' : 'تأیید و بازیابی سبد'}
              </Button>
            )}
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setReview(null)}>
              بستن بررسی
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
