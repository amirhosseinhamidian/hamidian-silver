'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/form-control';
import type { AdminPaymentAttempt } from '@/lib/orders/orders-model';

type PaymentReceiptReviewProps = Readonly<{
  attempt: AdminPaymentAttempt;
  canConfirm: boolean;
}>;

export function PaymentReceiptReview({ attempt, canConfirm }: PaymentReceiptReviewProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [rejected, setRejected] = useState(false);
  const [showRejectionForm, setShowRejectionForm] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const imageUrl = `/api/payment-receipts/${encodeURIComponent(attempt.id)}`;
  const awaitingReview = attempt.status === 'AWAITING_REVIEW' && !confirmed && !rejected;

  async function confirmReceipt() {
    if (confirming || !window.confirm('از تطبیق مبلغ و صحت رسید اطمینان دارید؟')) {
      return;
    }

    setConfirming(true);
    setError(null);

    try {
      const response = await fetch(imageUrl, { method: 'POST' });
      if (!response.ok) {
        let message = 'تأیید رسید انجام نشد.';
        try {
          const payload = (await response.json()) as {
            message?: string | string[];
            error?: { message?: string | string[] };
          };
          const received = payload.error?.message ?? payload.message;
          message = Array.isArray(received) ? received.join('، ') : received || message;
        } catch {
          // Keep fallback.
        }
        setError(message);
        return;
      }

      setConfirmed(true);
      router.refresh();
    } catch {
      setError('ارتباط با سرویس پرداخت برقرار نشد.');
    } finally {
      setConfirming(false);
    }
  }

  async function rejectReceipt() {
    const reason = rejectionReason.trim();
    if (rejecting || reason.length < 3) {
      setError('دلیل رد رسید باید حداقل ۳ نویسه باشد.');
      return;
    }

    setRejecting(true);
    setError(null);

    try {
      const response = await fetch(imageUrl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      if (!response.ok) {
        let message = 'رد رسید انجام نشد.';
        try {
          const payload = (await response.json()) as {
            message?: string | string[];
            error?: { message?: string | string[] };
          };
          const received = payload.error?.message ?? payload.message;
          message = Array.isArray(received) ? received.join('، ') : received || message;
        } catch {
          // Keep fallback.
        }
        setError(message);
        return;
      }

      setRejected(true);
      setShowRejectionForm(false);
      router.refresh();
    } catch {
      setError('ارتباط با سرویس پرداخت برقرار نشد.');
    } finally {
      setRejecting(false);
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-[var(--admin-color-border)] bg-white p-3">
      <div className="flex flex-wrap items-start gap-4">
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="relative h-32 w-28 shrink-0 overflow-hidden rounded-lg border border-[var(--admin-color-border)] bg-[var(--admin-color-surface-subtle)]"
          aria-label="بزرگ‌نمایی تصویر رسید"
        >
          <Image
            src={imageUrl}
            alt="تصویر رسید کارت‌به‌کارت"
            fill
            unoptimized
            className="object-cover"
            sizes="112px"
          />
        </button>

        <div className="min-w-0 flex-1 text-xs">
          <p className="font-bold">رسید کارت‌به‌کارت</p>
          <p className="mt-2 break-all text-[var(--admin-color-muted)]">
            {attempt.receiptOriginalName ?? 'بدون نام'}
          </p>
          {attempt.receiptSizeBytes ? (
            <p className="mt-1 text-[var(--admin-color-muted)]">
              {(attempt.receiptSizeBytes / 1024 / 1024).toLocaleString('fa-IR', {
                maximumFractionDigits: 2,
              })}{' '}
              مگابایت
            </p>
          ) : null}
          <Button
            type="button"
            size="sm"
            className="mt-4"
            disabled={!awaitingReview || !canConfirm}
            loading={confirming}
            onClick={confirmReceipt}
          >
            {confirmed || attempt.status === 'VERIFIED' ? 'رسید تأیید شده' : 'تأیید رسید و پرداخت'}
          </Button>
          {awaitingReview && canConfirm ? (
            <Button
              type="button"
              size="sm"
              variant="danger"
              className="mt-4 ms-2"
              disabled={confirming || rejecting}
              onClick={() => {
                setError(null);
                setShowRejectionForm((current) => !current);
              }}
            >
              رد رسید
            </Button>
          ) : null}
        </div>
      </div>

      {showRejectionForm && awaitingReview ? (
        <div className="mt-4 space-y-3 border-t border-[var(--admin-color-border)] pt-4">
          <label htmlFor={`receipt-rejection-${attempt.id}`} className="block text-sm font-bold">
            دلیل رد رسید
          </label>
          <Textarea
            id={`receipt-rejection-${attempt.id}`}
            value={rejectionReason}
            maxLength={200}
            placeholder="مثلاً مبلغ واریزی با مبلغ سفارش مطابقت ندارد."
            onChange={(event) => setRejectionReason(event.target.value)}
          />
          <p className="text-xs text-[var(--admin-color-muted)]">
            این دلیل در جزئیات سفارش مشتری نمایش داده می‌شود و باید واضح و محترمانه باشد.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="danger"
              loading={rejecting}
              disabled={rejectionReason.trim().length < 3 || confirming}
              onClick={() => void rejectReceipt()}
            >
              تأیید رد رسید
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={rejecting}
              onClick={() => setShowRejectionForm(false)}
            >
              انصراف
            </Button>
          </div>
        </div>
      ) : null}

      {rejected || attempt.failureCode === 'CARD_TO_CARD_RECEIPT_REJECTED' ? (
        <Alert tone="warning">رسید رد شده و امکان ثبت رسید جدید برای مشتری باز است.</Alert>
      ) : null}

      {error ? <Alert tone="danger">{error}</Alert> : null}

      {expanded ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="تصویر بزرگ رسید پرداخت"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-5"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setExpanded(false);
          }}
        >
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="absolute end-5 top-5 rounded-lg bg-white px-4 py-2 text-sm font-bold"
          >
            بستن
          </button>
          <div className="relative h-[82vh] w-[92vw]">
            <Image
              src={imageUrl}
              alt="تصویر بزرگ رسید کارت‌به‌کارت"
              fill
              unoptimized
              className="object-contain"
              sizes="92vw"
              priority
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
