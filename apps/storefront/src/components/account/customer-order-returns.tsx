'use client';

import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';

import { formatOrderDate } from '@/components/account/account-order-presentation';
import type { CustomerOrderDetail, CustomerOrderReturn } from '@/components/account/account-types';
import { readResponseError, toPersianDigits } from '@/components/account/account-types';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/form-control';
import { QuantityControl } from '@/components/ui/quantity-control';

const RETURN_STATUS_LABELS: Record<string, string> = {
  REQUESTED: 'در انتظار بررسی',
  RECEIVED: 'دریافت‌شده',
  CANCELLED: 'لغوشده',
};

type ReturnListState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; items: CustomerOrderReturn[] };

function returnStatusLabel(status: string): string {
  return RETURN_STATUS_LABELS[status] ?? status;
}

export function CustomerOrderReturns({ order }: Readonly<{ order: CustomerOrderDetail }>) {
  const [state, setState] = useState<ReturnListState>({ status: 'loading' });
  const [formOpen, setFormOpen] = useState(false);
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [available, setAvailable] = useState<Record<string, number>>(() =>
    Object.fromEntries(order.items.map((item) => [item.id, item.returnableQuantity])),
  );
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void fetch(`/api/orders/${encodeURIComponent(order.id)}/returns`, { cache: 'no-store' })
      .then(async (response) => {
        if (!active) return;
        if (!response.ok) {
          setState({ status: 'error', message: await readResponseError(response) });
          return;
        }
        setState({ status: 'ready', items: (await response.json()) as CustomerOrderReturn[] });
      })
      .catch(
        () =>
          active && setState({ status: 'error', message: 'دریافت درخواست‌های مرجوعی انجام نشد.' }),
      );

    return () => {
      active = false;
    };
  }, [order.id]);

  const returnableItems = order.items.filter((item) => (available[item.id] ?? 0) > 0);
  const selectedItems = returnableItems
    .map((item) => ({ orderItemId: item.id, quantity: selected[item.id] ?? 0 }))
    .filter((item) => item.quantity > 0);

  function toggleItem(orderItemId: string, checked: boolean) {
    setSelected((current) => ({ ...current, [orderItemId]: checked ? 1 : 0 }));
  }

  async function submitReturn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedReason = reason.trim();
    if (!selectedItems.length) {
      setFormError('حداقل یک کالا را برای مرجوعی انتخاب کنید.');
      return;
    }
    if (normalizedReason.length < 3) {
      setFormError('دلیل مرجوعی را در حداقل سه نویسه وارد کنید.');
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(order.id)}/returns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: selectedItems, reason: normalizedReason }),
      });
      if (!response.ok) {
        setFormError(await readResponseError(response));
        return;
      }

      const created = (await response.json()) as CustomerOrderReturn;
      setState((current) =>
        current.status === 'ready'
          ? { status: 'ready', items: [created, ...current.items] }
          : { status: 'ready', items: [created] },
      );
      setAvailable((current) => {
        const next = { ...current };
        for (const item of selectedItems) {
          next[item.orderItemId] = Math.max(0, (next[item.orderItemId] ?? 0) - item.quantity);
        }
        return next;
      });
      setSelected({});
      setReason('');
      setFormOpen(false);
    } catch {
      setFormError('ارتباط با سرویس مرجوعی برقرار نشد. دوباره تلاش کنید.');
    } finally {
      setSubmitting(false);
    }
  }

  async function cancelReturn(orderReturn: CustomerOrderReturn) {
    if (cancellingId) return;
    setCancellingId(orderReturn.id);
    setFormError(null);
    try {
      const response = await fetch(`/api/order-returns/${encodeURIComponent(orderReturn.id)}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        setFormError(await readResponseError(response));
        return;
      }

      const cancelled = (await response.json()) as CustomerOrderReturn;
      setState((current) =>
        current.status === 'ready'
          ? {
              status: 'ready',
              items: current.items.map((item) => (item.id === cancelled.id ? cancelled : item)),
            }
          : current,
      );
      setAvailable((current) => {
        const next = { ...current };
        for (const item of orderReturn.items) {
          next[item.orderItemId] = (next[item.orderItemId] ?? 0) + item.quantity;
        }
        return next;
      });
      setConfirmCancelId(null);
    } catch {
      setFormError('لغو درخواست مرجوعی انجام نشد. دوباره تلاش کنید.');
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <section
      aria-labelledby="order-returns-heading"
      className="border border-[var(--sf-color-border)] p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="order-returns-heading" className="text-xl font-medium">
            مرجوعی سفارش
          </h2>
          <p className="mt-2 text-sm leading-7 text-[var(--sf-color-muted)]">
            این بخش پس از بررسی مشکل و تأیید پشتیبانی برای سفارش شما فعال شده است.
          </p>
        </div>
        {!formOpen && returnableItems.length > 0 ? (
          <Button variant="outline" onClick={() => setFormOpen(true)}>
            ثبت درخواست مرجوعی
          </Button>
        ) : null}
      </div>

      {formOpen ? (
        <form
          className="mt-6 border-t border-[var(--sf-color-border)] pt-5"
          onSubmit={submitReturn}
        >
          <fieldset disabled={submitting}>
            <legend className="font-medium">انتخاب کالاها</legend>
            <div className="mt-4 space-y-3">
              {returnableItems.map((item) => {
                const quantity = selected[item.id] ?? 0;
                const max = available[item.id] ?? 0;
                return (
                  <div
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-4 border border-[var(--sf-color-border)] p-4"
                  >
                    <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
                      <input
                        type="checkbox"
                        className="mt-1 size-4 accent-[var(--sf-color-ink)]"
                        checked={quantity > 0}
                        onChange={(event) => toggleItem(item.id, event.target.checked)}
                      />
                      <span>
                        <span className="block font-medium">
                          {toPersianDigits(item.productNameSnapshot)}
                        </span>
                        <span className="mt-1 block text-xs text-[var(--sf-color-muted)]">
                          قابل مرجوعی: {toPersianDigits(max)} عدد
                        </span>
                      </span>
                    </label>
                    {quantity > 0 ? (
                      <QuantityControl
                        compact
                        value={quantity}
                        max={max}
                        disabled={submitting}
                        label={`تعداد مرجوعی ${toPersianDigits(item.productNameSnapshot)}`}
                        onChange={(value) =>
                          setSelected((current) => ({ ...current, [item.id]: value }))
                        }
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>
          </fieldset>

          <label className="mt-5 block text-sm font-medium" htmlFor="return-reason">
            دلیل مرجوعی
          </label>
          <Textarea
            id="return-reason"
            className="mt-2"
            minLength={3}
            maxLength={1000}
            required
            placeholder="مغایرت کالای ارسال‌شده یا مشکل بحرانی تأییدشده را شرح دهید."
            value={reason}
            disabled={submitting}
            onChange={(event) => setReason(event.target.value)}
          />
          <div className="mt-4 flex flex-wrap gap-3">
            <Button type="submit" loading={submitting}>
              ارسال درخواست
            </Button>
            <Button
              variant="outline"
              disabled={submitting}
              onClick={() => {
                setFormOpen(false);
                setFormError(null);
              }}
            >
              انصراف
            </Button>
          </div>
        </form>
      ) : null}

      {formError ? (
        <p role="alert" className="mt-4 text-sm text-red-700">
          {formError}
        </p>
      ) : null}

      {state.status === 'loading' ? (
        <p className="mt-6 text-sm text-[var(--sf-color-muted)]">در حال دریافت درخواست‌ها…</p>
      ) : null}
      {state.status === 'error' ? (
        <p role="alert" className="mt-6 text-sm text-red-700">
          {state.message}
        </p>
      ) : null}
      {state.status === 'ready' && state.items.length > 0 ? (
        <ul className="mt-6 space-y-4 border-t border-[var(--sf-color-border)] pt-5">
          {state.items.map((orderReturn) => (
            <li key={orderReturn.id} className="bg-[var(--sf-color-surface)] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{returnStatusLabel(orderReturn.status)}</p>
                  <time
                    dateTime={orderReturn.createdAt}
                    className="mt-1 block text-xs text-[var(--sf-color-subtle)]"
                  >
                    ثبت‌شده در {formatOrderDate(orderReturn.createdAt, true)}
                  </time>
                </div>
                {orderReturn.status === 'REQUESTED' ? (
                  confirmCancelId === orderReturn.id ? (
                    <div className="flex gap-2" role="group" aria-label="تأیید لغو درخواست مرجوعی">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={cancellingId === orderReturn.id}
                        onClick={() => setConfirmCancelId(null)}
                      >
                        انصراف
                      </Button>
                      <Button
                        size="sm"
                        loading={cancellingId === orderReturn.id}
                        onClick={() => cancelReturn(orderReturn)}
                      >
                        تأیید لغو
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setConfirmCancelId(orderReturn.id)}
                    >
                      لغو درخواست
                    </Button>
                  )
                ) : null}
              </div>
              <ul className="mt-3 space-y-1 text-sm text-[var(--sf-color-muted)]">
                {orderReturn.items.map((returnItem) => {
                  const orderItem = order.items.find((item) => item.id === returnItem.orderItemId);
                  return (
                    <li key={returnItem.id}>
                      {orderItem ? toPersianDigits(orderItem.productNameSnapshot) : 'کالای سفارش'} ·{' '}
                      {toPersianDigits(returnItem.quantity)} عدد
                    </li>
                  );
                })}
              </ul>
              {orderReturn.reason ? (
                <p className="mt-3 text-sm leading-7">{toPersianDigits(orderReturn.reason)}</p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {state.status === 'ready' && state.items.length === 0 && !formOpen ? (
        <p className="mt-6 text-sm text-[var(--sf-color-muted)]">
          هنوز درخواست مرجوعی برای این سفارش ثبت نشده است.
        </p>
      ) : null}
      {returnableItems.length === 0 && !formOpen ? (
        <p className="mt-4 text-xs leading-6 text-[var(--sf-color-subtle)]">
          در حال حاضر کالای دیگری برای ثبت درخواست مرجوعی باقی نمانده است.
        </p>
      ) : null}
    </section>
  );
}
