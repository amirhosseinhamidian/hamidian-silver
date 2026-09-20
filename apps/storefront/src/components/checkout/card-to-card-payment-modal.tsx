'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { FiCheck, FiClipboard, FiUploadCloud, FiX } from 'react-icons/fi';

import { Button } from '@/components/ui/button';
import { formatTomanPrice } from '@/lib/catalog/presentation';
import {
  IRANIAN_BANKS,
  recommendTransfer,
} from '@/lib/checkout/transfer-recommendation';

export type CardToCardSettings = Readonly<{
  enabled: boolean;
  cardNumber: string | null;
  ibanNumber: string | null;
  holderName: string | null;
  bankName: string | null;
}>;

type CardToCardPaymentModalProps = Readonly<{
  open: boolean;
  orderId: string;
  orderNumber: string;
  amountToman: number;
  settings: CardToCardSettings;
  onClose: () => void;
  onSubmitted: () => void;
}>;

const MAX_RECEIPT_SIZE = 10 * 1024 * 1024;
const ALLOWED_RECEIPT_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function groupedCardNumber(cardNumber: string): string {
  return cardNumber.replace(/(\d{4})(?=\d)/g, '$1 ');
}

function groupedIban(ibanNumber: string): string {
  return `IR${ibanNumber}`.replace(/(.{4})(?=.)/g, '$1 ');
}

export function CardToCardPaymentModal({
  open,
  orderId,
  orderNumber,
  amountToman,
  settings,
  onClose,
  onSubmitted,
}: CardToCardPaymentModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [copied, setCopied] = useState<'card' | 'iban' | null>(null);
  const [sourceBank, setSourceBank] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const idempotencyKey = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !uploading) onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose, open, uploading]);

  const fileSize = useMemo(() => {
    if (!file) return null;
    return `${new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 }).format(
      file.size / 1024 / 1024,
    )} مگابایت`;
  }, [file]);
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  const recommendation = useMemo(
    () => recommendTransfer(amountToman, sourceBank, settings.bankName ?? ''),
    [amountToman, settings.bankName, sourceBank],
  );

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  const { cardNumber, ibanNumber, holderName, bankName } = settings;

  if (!open || !settings.enabled || !cardNumber || !ibanNumber || !holderName || !bankName) {
    return null;
  }

  async function copyValue(value: string, kind: 'card' | 'iban') {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 2500);
    } catch {
      setError('کپی خودکار انجام نشد؛ شماره را به‌صورت دستی انتخاب کنید.');
    }
  }

  function selectReceipt(nextFile?: File) {
    setError(null);
    if (!nextFile) {
      setFile(null);
      return;
    }
    if (!ALLOWED_RECEIPT_TYPES.has(nextFile.type)) {
      setError('فرمت رسید باید JPEG، PNG یا WebP باشد.');
      return;
    }
    if (nextFile.size <= 0 || nextFile.size > MAX_RECEIPT_SIZE) {
      setError('حجم تصویر رسید باید حداکثر ۱۰ مگابایت باشد.');
      return;
    }
    setFile(nextFile);
  }

  async function uploadReceipt() {
    if (!file || uploading) return;
    setUploading(true);
    setError(null);

    try {
      const body = new FormData();
      idempotencyKey.current ??= crypto.randomUUID();
      body.set('orderId', orderId);
      body.set('idempotencyKey', idempotencyKey.current);
      body.set('file', file);

      const response = await fetch('/api/checkout/card-to-card', {
        method: 'POST',
        body,
      });

      if (!response.ok) {
        let message = 'ثبت رسید انجام نشد. دوباره تلاش کنید.';
        try {
          const payload = (await response.json()) as {
            message?: string | string[];
            error?: { message?: string | string[] };
          };
          const received = payload.error?.message ?? payload.message;
          message = Array.isArray(received) ? received.join('، ') : received || message;
        } catch {
          // Keep the localized fallback.
        }
        setError(message);
        return;
      }

      onSubmitted();
    } catch {
      setError('ارتباط با سرویس پرداخت برقرار نشد. دوباره تلاش کنید.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/55 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !uploading) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="card-to-card-title"
        className="max-h-[94vh] w-full max-w-xl overflow-y-auto rounded-t-[1.75rem] bg-[var(--sf-color-canvas)] p-5 shadow-2xl sm:rounded-[1.75rem] sm:p-8"
      >
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs tracking-[0.14em] text-[var(--sf-color-muted)]">
              پرداخت سفارش {orderNumber}
            </p>
            <h2 id="card-to-card-title" className="mt-2 text-2xl font-medium">
              {step === 1 ? 'اطلاعات کارت مقصد' : 'بارگذاری رسید پرداخت'}
            </h2>
          </div>
          <button
            type="button"
            aria-label="بستن"
            disabled={uploading}
            onClick={onClose}
            className="flex size-10 items-center justify-center rounded-full border border-[var(--sf-color-border)] disabled:opacity-50"
          >
            <FiX aria-hidden="true" />
          </button>
        </header>

        <div className="mt-6 flex gap-2" aria-label={`مرحله ${step} از ۲`}>
          <span className="h-1 flex-1 rounded-full bg-[var(--sf-color-ink)]" />
          <span
            className={`h-1 flex-1 rounded-full ${
              step === 2 ? 'bg-[var(--sf-color-ink)]' : 'bg-[var(--sf-color-border)]'
            }`}
          />
        </div>

        {step === 1 ? (
          <>
            <div className="relative mt-7 overflow-hidden rounded-[1.4rem] bg-[#111] p-6 text-white shadow-[0_24px_60px_rgb(0_0_0/0.24)]">
              <div className="absolute -end-12 -top-16 size-40 rounded-full border border-white/10" />
              <div className="absolute -bottom-24 -start-10 size-48 rounded-full bg-white/[0.04]" />
              <div className="relative flex min-h-56 flex-col justify-between">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm font-medium">{bankName}</span>
                  <span className="size-10 rounded-full border border-white/25 bg-white/10" />
                </div>
                <button
                  type="button"
                  dir="ltr"
                  onClick={() => void copyValue(cardNumber, 'card')}
                  className="my-7 whitespace-nowrap text-center font-mono text-[clamp(1.5rem,7vw,1.875rem)] tracking-normal sm:text-4xl sm:tracking-[0.08em]"
                  title="کپی شماره کارت"
                >
                  {groupedCardNumber(cardNumber)}
                </button>
                <div>
                  <p className="text-[0.65rem] text-white/55">صاحب حساب</p>
                  <p className="mt-1 text-sm">{holderName}</p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void copyValue(cardNumber, 'card')}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--sf-color-border)] px-4 py-3 text-sm font-medium"
            >
              {copied === 'card' ? (
                <FiCheck aria-hidden="true" />
              ) : (
                <FiClipboard aria-hidden="true" />
              )}
              {copied === 'card' ? 'شماره کارت کپی شد' : 'کپی شماره کارت'}
            </button>

            <div className="mt-4 rounded-2xl border border-[var(--sf-color-border)] bg-[var(--sf-color-surface)] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-[var(--sf-color-muted)]">شماره شبا</p>
                  <p className="mt-1 text-[0.7rem] text-[var(--sf-color-muted)]">
                    در زمان کپی، فقط ۲۴ رقم بدون IR کپی می‌شود.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void copyValue(ibanNumber, 'iban')}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--sf-color-border)] px-3 py-2 text-xs font-medium"
                  title="کپی شماره شبا بدون IR"
                >
                  {copied === 'iban' ? (
                    <FiCheck aria-hidden="true" />
                  ) : (
                    <FiClipboard aria-hidden="true" />
                  )}
                  {copied === 'iban' ? 'بدون IR کپی شد' : 'کپی شبا'}
                </button>
              </div>
              <button
                type="button"
                dir="ltr"
                onClick={() => void copyValue(ibanNumber, 'iban')}
                className="mt-4 w-full break-all text-center font-mono text-sm tracking-[0.06em] sm:text-base"
                title="کپی شماره شبا بدون IR"
              >
                {groupedIban(ibanNumber)}
              </button>
            </div>

            <div className="mt-5 flex items-center justify-between gap-4 border-y border-[var(--sf-color-border)] py-4 text-sm">
              <span className="text-[var(--sf-color-muted)]">مبلغ واریز</span>
              <strong className="text-lg sm:text-xl">{formatTomanPrice(amountToman)}</strong>
            </div>

            <div className="mt-5 rounded-2xl border border-[var(--sf-color-border)] p-4">
              <label htmlFor="source-bank" className="text-xs text-[var(--sf-color-muted)]">
                بانک مبدأ شما کدام است؟
              </label>
              <select
                id="source-bank"
                value={sourceBank}
                onChange={(event) => setSourceBank(event.target.value)}
                className="mt-2 min-h-11 w-full rounded-xl border border-[var(--sf-color-border)] bg-[var(--sf-color-canvas)] px-3 text-sm outline-none focus:border-[var(--sf-color-ink)]"
              >
                <option value="">انتخاب بانک مبدأ (اختیاری)</option>
                {IRANIAN_BANKS.map((bank) => (
                  <option key={bank} value={bank}>
                    {bank}
                  </option>
                ))}
              </select>

              <div className="mt-4 border-t border-[var(--sf-color-border)] pt-4">
                <p className="text-xs text-[var(--sf-color-muted)]">
                  روش پیشنهادی برای پرداخت این سفارش
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <strong className="text-base">{recommendation.title}</strong>
                  <span className="rounded-full bg-[var(--sf-color-ink)] px-2 py-1 text-[0.65rem] text-white">
                    {recommendation.speed}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-6">{recommendation.description}</p>
                {recommendation.alternative ? (
                  <p className="mt-2 text-xs leading-6 text-[var(--sf-color-muted)]">
                    {recommendation.alternative}
                  </p>
                ) : null}
                <p className="mt-3 text-[0.68rem] leading-5 text-[var(--sf-color-muted)]">
                  سقف قابل استفاده ممکن است با توجه به بانک، نوع حساب و محدودیت همراه‌بانک شما
                  متفاوت باشد.
                </p>
              </div>
            </div>

            <p className="mt-4 text-xs leading-6 text-[var(--sf-color-muted)]">
              پس از واریز مبلغ دقیق سفارش، تصویر رسید را در مرحله بعد بارگذاری کنید.
            </p>

            <Button type="button" className="mt-6 w-full" onClick={() => setStep(2)}>
              پرداخت انجام شد؛ ثبت رسید
            </Button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-7 flex min-h-48 w-full flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed border-[var(--sf-color-border-strong)] bg-[var(--sf-color-surface)] p-4 text-center"
            >
              {previewUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element -- This preview uses a local object URL selected by the customer. */}
                  <img
                    src={previewUrl}
                    alt="پیش‌نمایش رسید انتخاب‌شده"
                    className="max-h-72 w-full object-contain"
                  />
                  <strong className="mt-3 break-all text-sm">{file?.name}</strong>
                  <span className="mt-1 text-xs text-[var(--sf-color-muted)]">
                    {fileSize} · برای تغییر تصویر لمس کنید
                  </span>
                </>
              ) : (
                <>
                  <FiUploadCloud aria-hidden="true" size={32} />
                  <strong className="mt-4 text-sm">انتخاب تصویر رسید</strong>
                  <span className="mt-2 text-xs leading-6 text-[var(--sf-color-muted)]">
                    فرمت JPEG، PNG یا WebP با حداکثر حجم ۱۰ مگابایت
                  </span>
                </>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(event) => selectReceipt(event.target.files?.[0])}
            />

            {error ? (
              <p role="alert" className="mt-4 text-xs leading-6 text-red-600">
                {error}
              </p>
            ) : null}

            <div className="mt-6 flex gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={uploading}
                onClick={() => setStep(1)}
                className="flex-1"
              >
                بازگشت
              </Button>
              <Button
                type="button"
                loading={uploading}
                disabled={!file}
                onClick={uploadReceipt}
                className="flex-[2]"
              >
                ثبت نهایی رسید
              </Button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
