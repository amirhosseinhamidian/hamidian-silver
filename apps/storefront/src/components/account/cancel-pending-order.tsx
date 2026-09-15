'use client';

import { useState } from 'react';

import type { CustomerOrderDetail } from '@/components/account/account-types';
import { readResponseError } from '@/components/account/account-types';
import { Button } from '@/components/ui/button';

type CancelPendingOrderProps = Readonly<{
  orderId: string;
  onCancelled: (order: CustomerOrderDetail) => void;
}>;

export function CancelPendingOrder({ orderId, onCancelled }: CancelPendingOrderProps) {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancelOrder() {
    if (loading) return;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}`, {
        method: 'POST',
      });

      if (!response.ok) {
        setError(await readResponseError(response));
        return;
      }

      onCancelled((await response.json()) as CustomerOrderDetail);
    } catch {
      setError('ارتباط با سرویس سفارش برقرار نشد. دوباره تلاش کنید.');
    } finally {
      setLoading(false);
    }
  }

  if (!confirming) {
    return (
      <Button variant="outline" className="w-full" onClick={() => setConfirming(true)}>
        لغو سفارش
      </Button>
    );
  }

  return (
    <div role="group" aria-label="تأیید لغو سفارش">
      <p className="text-sm leading-7 text-[var(--sf-color-muted)]">
        با لغو سفارش، موجودی رزروشده آزاد می‌شود و ادامه پرداخت آن ممکن نخواهد بود.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Button variant="outline" disabled={loading} onClick={() => setConfirming(false)}>
          انصراف
        </Button>
        <Button loading={loading} onClick={cancelOrder}>
          تأیید لغو سفارش
        </Button>
      </div>
      {error ? (
        <p role="alert" className="mt-3 text-xs leading-6 text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
