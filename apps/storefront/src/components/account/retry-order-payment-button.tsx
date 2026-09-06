'use client';

import type { components } from '@hamidian/contracts';
import { useEffect, useState } from 'react';

import { readResponseError } from '@/components/account/account-types';
import { Button } from '@/components/ui/button';

type PaymentInitiationResponse = components['schemas']['PaymentInitiationResponseDto'];

type RetryOrderPaymentButtonProps = Readonly<{
  orderId: string;
  reservationExpiresAt: string;
  redirectToPayment?: (paymentUrl: string) => void;
}>;

function validPaymentUrl(value: string | undefined): string | null {
  if (!value) return null;

  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export function RetryOrderPaymentButton({
  orderId,
  reservationExpiresAt,
  redirectToPayment = (paymentUrl) => window.location.assign(paymentUrl),
}: RetryOrderPaymentButtonProps) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const expiresAt = Date.parse(reservationExpiresAt);
  const [reservationExpired, setReservationExpired] = useState(false);

  useEffect(() => {
    if (!Number.isFinite(expiresAt)) return;

    let timeoutId: number | undefined;
    const updateExpiration = () => {
      const remainingMilliseconds = expiresAt - Date.now();
      if (remainingMilliseconds <= 0) {
        setReservationExpired(true);
        return;
      }

      setReservationExpired(false);
      timeoutId = window.setTimeout(
        updateExpiration,
        Math.min(remainingMilliseconds, 2_147_483_647),
      );
    };

    timeoutId = window.setTimeout(updateExpiration, 0);
    return () => {
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, [expiresAt]);

  async function retryPayment() {
    if (loading || reservationExpired) return;
    if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) {
      setReservationExpired(true);
      return;
    }

    setLoading(true);
    setMessage(null);
    setIsError(false);

    try {
      const response = await fetch('/api/checkout/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, idempotencyKey: crypto.randomUUID() }),
      });

      if (!response.ok) {
        setIsError(true);
        setMessage(await readResponseError(response));
        return;
      }

      const payment = (await response.json()) as PaymentInitiationResponse;
      if (payment.alreadyPaid || payment.reconciled) {
        setMessage('پرداخت این سفارش قبلاً تأیید شده است. صفحه را دوباره بارگذاری کنید.');
        return;
      }
      if (payment.reconciliationRequired) {
        setMessage('نتیجه پرداخت در حال بررسی است. تا مشخص‌شدن وضعیت، پرداخت را تکرار نکنید.');
        return;
      }

      const paymentUrl = validPaymentUrl(payment.paymentUrl);
      if (!paymentUrl) {
        setIsError(true);
        setMessage('درگاه پرداخت آدرس انتقال معتبری برنگرداند.');
        return;
      }

      redirectToPayment(paymentUrl);
    } catch {
      setIsError(true);
      setMessage('ارتباط با سرویس پرداخت برقرار نشد. دوباره تلاش کنید.');
    } finally {
      setLoading(false);
    }
  }

  if (reservationExpired) {
    return (
      <p className="text-sm leading-7 text-[var(--sf-color-muted)]">
        مهلت پرداخت این سفارش به پایان رسیده است. برای خرید، کالاها را دوباره به سبد اضافه کنید.
      </p>
    );
  }

  return (
    <div>
      <Button className="w-full" loading={loading} onClick={retryPayment}>
        پرداخت سفارش
      </Button>
      {message ? (
        <p
          role={isError ? 'alert' : 'status'}
          className={`mt-3 text-xs leading-6 ${isError ? 'text-red-700' : 'text-[var(--sf-color-muted)]'}`}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
