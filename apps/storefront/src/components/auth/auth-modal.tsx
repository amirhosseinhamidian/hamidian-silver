'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import Image from 'next/image';
import {
  type ChangeEvent,
  type ClipboardEvent,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from 'react';
import { FiAlertCircle, FiCheck, FiEdit2, FiRefreshCw, FiUser, FiX } from 'react-icons/fi';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form-control';
import { cn } from '@/lib/ui/cn';

const OTP_LENGTH = 5;
const OTP_LIFETIME_SECONDS = 120;
const SUCCESS_ANIMATION_MS = 900;
const SUCCESS_CLOSE_DELAY_MS = 500;
const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

type AuthStep = 'phone' | 'otp' | 'success';

type OtpRequestResponse = Readonly<{
  challengeId: string;
  expiresAt: string;
}>;

type ApiErrorPayload = Readonly<{
  error?: {
    code?: string;
    message?: string;
  };
  message?: string;
}>;

class AuthRequestError extends Error {
  constructor(
    readonly status: number,
    readonly payload: ApiErrorPayload | null,
  ) {
    super(payload?.error?.message ?? payload?.message ?? 'Authentication request failed.');
    this.name = 'AuthRequestError';
  }
}

function toAsciiDigits(value: string): string {
  return [...value]
    .map((character) => {
      const persianIndex = PERSIAN_DIGITS.indexOf(character);
      if (persianIndex >= 0) return String(persianIndex);

      const arabicIndex = ARABIC_DIGITS.indexOf(character);
      if (arabicIndex >= 0) return String(arabicIndex);

      return character;
    })
    .join('');
}

function toPersianDigits(value: string): string {
  return value.replace(/\d/g, (digit) => PERSIAN_DIGITS[Number(digit)] ?? digit);
}

function normalizePhoneInput(value: string): string {
  return toAsciiDigits(value).replace(/[^\d+]/g, '');
}

function normalizeOtpInput(value: string): string {
  return toAsciiDigits(value).replace(/\D/g, '').slice(0, OTP_LENGTH);
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  let response: Response;

  try {
    response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('NETWORK_ERROR');
  }

  const payload = (await response.json().catch(() => null)) as T | ApiErrorPayload | null;

  if (!response.ok) {
    throw new AuthRequestError(response.status, payload as ApiErrorPayload | null);
  }

  return payload as T;
}

function requestErrorMessage(error: unknown, action: 'request' | 'verify'): string {
  if (error instanceof AuthRequestError) {
    if (error.status === 429) {
      return 'تعداد درخواست‌ها زیاد است؛ کمی صبر کنید و دوباره تلاش کنید.';
    }

    if (error.status === 401 && action === 'verify') {
      return 'کد واردشده اشتباه است یا اعتبار آن به پایان رسیده است.';
    }

    if (error.status === 403) {
      return 'امکان ورود به این حساب وجود ندارد.';
    }

    if (error.status === 400) {
      return action === 'request'
        ? 'شماره همراه معتبر نیست؛ شماره را بررسی کنید.'
        : 'کد تأیید معتبر نیست.';
    }
  }

  if (error instanceof Error && error.message === 'NETWORK_ERROR') {
    return 'ارتباط با سرور برقرار نشد؛ اتصال اینترنت را بررسی کنید.';
  }

  return 'خطایی رخ داد؛ لطفاً دوباره تلاش کنید.';
}

function ErrorMessage({ id, children }: Readonly<{ id: string; children: string }>) {
  return (
    <p
      id={id}
      role="alert"
      className="mt-3 flex items-start justify-center gap-2 text-sm leading-6 text-red-600"
    >
      <FiAlertCircle aria-hidden="true" className="mt-0.5 shrink-0" size={18} />
      <span>{children}</span>
    </p>
  );
}

function OtpCountdown({ expiresAt }: Readonly<{ expiresAt: number }>) {
  const [remainingSeconds, setRemainingSeconds] = useState(() =>
    Math.min(OTP_LIFETIME_SECONDS, Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000))),
  );

  useEffect(() => {
    const update = () => {
      setRemainingSeconds(
        Math.min(OTP_LIFETIME_SECONDS, Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000))),
      );
    };

    update();
    const interval = window.setInterval(update, 250);
    return () => window.clearInterval(interval);
  }, [expiresAt]);

  const radius = 43;
  const circumference = 2 * Math.PI * radius;
  const progress = remainingSeconds / OTP_LIFETIME_SECONDS;
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const localizedTime = toPersianDigits(formattedTime);

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        role="timer"
        aria-label={`زمان باقی‌مانده ${localizedTime}`}
        className="relative grid size-28 place-items-center"
      >
        <svg aria-hidden="true" viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
          <circle cx="50" cy="50" r={radius} fill="none" stroke="#ebe9e6" strokeWidth="5" />
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="var(--sf-color-ink)"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - progress)}
            className="transition-[stroke-dashoffset] duration-300 ease-linear"
          />
        </svg>
        <span dir="ltr" className="text-2xl font-bold tabular-nums">
          {localizedTime}
        </span>
      </div>
    </div>
  );
}

type OtpCodeInputProps = Readonly<{
  digits: readonly string[];
  invalid: boolean;
  disabled: boolean;
  shakeKey: number;
  describedBy?: string;
  onChange: (digits: string[]) => void;
  onComplete: (code: string) => void;
}>;

function OtpCodeInput({
  digits,
  invalid,
  disabled,
  shakeKey,
  describedBy,
  onChange,
  onComplete,
}: OtpCodeInputProps) {
  const inputs = useRef<Array<HTMLInputElement | null>>([]);

  function commitFrom(index: number, value: string) {
    const incoming = normalizeOtpInput(value);
    const next = [...digits];

    if (!incoming) {
      next[index] = '';
      onChange(next);
      return;
    }

    incoming.split('').forEach((digit, offset) => {
      if (index + offset < OTP_LENGTH) next[index + offset] = digit;
    });

    onChange(next);
    if (next.every(Boolean)) onComplete(next.join(''));
    inputs.current[Math.min(index + incoming.length, OTP_LENGTH - 1)]?.focus();
  }

  function handleChange(index: number, event: ChangeEvent<HTMLInputElement>) {
    commitFrom(index, event.target.value);
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    const pasted = normalizeOtpInput(event.clipboardData.getData('text'));
    if (!pasted) return;

    event.preventDefault();
    const next = Array.from({ length: OTP_LENGTH }, (_, index) => pasted[index] ?? '');
    onChange(next);
    if (next.every(Boolean)) onComplete(next.join(''));
    inputs.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus();
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      event.preventDefault();
      const next = [...digits];
      next[index - 1] = '';
      onChange(next);
      inputs.current[index - 1]?.focus();
      return;
    }

    if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault();
      inputs.current[index - 1]?.focus();
    }

    if (event.key === 'ArrowRight' && index < OTP_LENGTH - 1) {
      event.preventDefault();
      inputs.current[index + 1]?.focus();
    }

    if (event.key === 'Home') {
      event.preventDefault();
      inputs.current[0]?.focus();
    }

    if (event.key === 'End') {
      event.preventDefault();
      inputs.current[OTP_LENGTH - 1]?.focus();
    }
  }

  return (
    <div
      key={shakeKey}
      dir="ltr"
      data-testid="otp-inputs"
      className={cn('flex justify-center gap-2.5 sm:gap-3', invalid && 'sf-auth-otp-error')}
    >
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(element) => {
            inputs.current[index] = element;
          }}
          value={toPersianDigits(digit)}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          maxLength={OTP_LENGTH}
          disabled={disabled}
          aria-label={`رقم ${toPersianDigits(String(index + 1))} از ${toPersianDigits(String(OTP_LENGTH))}`}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          autoFocus={index === 0}
          onChange={(event) => handleChange(index, event)}
          onPaste={handlePaste}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onFocus={(event) => event.currentTarget.select()}
          className="
            sf-auth-otp-input size-12 rounded-[var(--sf-radius-md)] border
            border-[var(--sf-color-border-strong)]
            bg-[var(--sf-color-surface)] text-center text-2xl font-bold tabular-nums
            outline-none transition-[border-color,transform] duration-200
            focus:border-[var(--sf-color-ink)] disabled:cursor-not-allowed leading-none
            disabled:opacity-60 sm:size-14 sm:text-3xl
            aria-[invalid=true]:border-red-600
          "
        />
      ))}
    </div>
  );
}

function SuccessState({ digits }: Readonly<{ digits: readonly string[] }>) {
  const shifts = [
    'calc(2 * var(--sf-auth-box-step))',
    'var(--sf-auth-box-step)',
    '0px',
    'calc(-1 * var(--sf-auth-box-step))',
    'calc(-2 * var(--sf-auth-box-step))',
  ];

  return (
    <div role="status" className="pt-1 text-center text-emerald-700">
      <div className="relative mx-auto grid h-24 place-items-center">
        <div dir="ltr" aria-hidden="true" className="sf-auth-success-boxes flex gap-2.5">
          {digits.map((digit, index) => (
            <span
              key={index}
              style={{ '--sf-auth-success-shift': shifts[index] } as CSSProperties}
              className="grid size-12 place-items-center rounded-[var(--sf-radius-md)] border border-emerald-600 text-2xl font-bold"
            >
              {toPersianDigits(digit)}
            </span>
          ))}
        </div>
        <span className="sf-auth-success-check absolute grid size-16 place-items-center rounded-full bg-emerald-600 text-white">
          <FiCheck aria-hidden="true" size={36} strokeWidth={2.5} />
        </span>
      </div>
      <p className="mt-3 text-lg font-bold">با موفقیت وارد شدید</p>
    </div>
  );
}

export function AccountAuthButton({ className }: Readonly<{ className?: string }>) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<AuthStep>('phone');
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [digits, setDigits] = useState(() => Array<string>(OTP_LENGTH).fill(''));
  const [otpError, setOtpError] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [expiresAt, setExpiresAt] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(OTP_LIFETIME_SECONDS);
  const [shakeKey, setShakeKey] = useState(0);
  const verificationInFlight = useRef(false);

  useEffect(() => {
    if (step !== 'otp' || !expiresAt) return;

    const update = () => {
      setRemainingSeconds(
        Math.min(OTP_LIFETIME_SECONDS, Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000))),
      );
    };

    update();
    const interval = window.setInterval(update, 250);
    return () => window.clearInterval(interval);
  }, [expiresAt, step]);

  useEffect(() => {
    if (step !== 'success') return;

    const timeout = window.setTimeout(
      () => setOpen(false),
      SUCCESS_ANIMATION_MS + SUCCESS_CLOSE_DELAY_MS,
    );

    return () => window.clearTimeout(timeout);
  }, [step]);

  function resetFlow() {
    setStep('phone');
    setPhone('');
    setPhoneError('');
    setPhoneLoading(false);
    setDigits(Array<string>(OTP_LENGTH).fill(''));
    setOtpError('');
    setOtpLoading(false);
    setResendLoading(false);
    setExpiresAt(0);
    setRemainingSeconds(OTP_LIFETIME_SECONDS);
    setShakeKey(0);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) resetFlow();
    setOpen(nextOpen);
  }

  async function handlePhoneSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (phoneLoading) return;

    const normalizedPhone = normalizePhoneInput(phone);
    if (!/^09\d{9}$/.test(normalizedPhone)) {
      setPhoneError('شماره همراه را به‌صورت ۱۱ رقمی و با ۰۹ وارد کنید.');
      return;
    }

    setPhoneError('');
    setPhoneLoading(true);

    try {
      const response = await postJson<OtpRequestResponse>('/api/auth/otp/request', {
        phone: normalizedPhone,
      });
      const serverExpiry = new Date(response.expiresAt).getTime();

      setPhone(normalizedPhone);
      setExpiresAt(Number.isFinite(serverExpiry) ? serverExpiry : Date.now() + 120_000);
      setRemainingSeconds(OTP_LIFETIME_SECONDS);
      setStep('otp');
    } catch (error) {
      setPhoneError(requestErrorMessage(error, 'request'));
    } finally {
      setPhoneLoading(false);
    }
  }

  async function verifyOtp(code: string) {
    if (verificationInFlight.current) return;

    if (code.length !== OTP_LENGTH) {
      setOtpError('کد تأیید ۵ رقمی را کامل وارد کنید.');
      setShakeKey((value) => value + 1);
      return;
    }

    if (remainingSeconds <= 0) {
      setOtpError('اعتبار کد به پایان رسیده است؛ کد جدید درخواست کنید.');
      setShakeKey((value) => value + 1);
      return;
    }

    setOtpError('');
    verificationInFlight.current = true;
    setOtpLoading(true);

    try {
      await postJson('/api/auth/otp/verify', { phone, code });
      setStep('success');
    } catch (error) {
      setOtpError(requestErrorMessage(error, 'verify'));
      setShakeKey((value) => value + 1);
    } finally {
      verificationInFlight.current = false;
      setOtpLoading(false);
    }
  }

  function handleOtpSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void verifyOtp(digits.join(''));
  }

  async function handleResend() {
    if (remainingSeconds > 0 || resendLoading) return;

    setOtpError('');
    setResendLoading(true);

    try {
      const response = await postJson<OtpRequestResponse>('/api/auth/otp/request', { phone });
      const serverExpiry = new Date(response.expiresAt).getTime();

      setDigits(Array<string>(OTP_LENGTH).fill(''));
      setExpiresAt(Number.isFinite(serverExpiry) ? serverExpiry : Date.now() + 120_000);
      setRemainingSeconds(OTP_LIFETIME_SECONDS);
    } catch (error) {
      setOtpError(requestErrorMessage(error, 'request'));
    } finally {
      setResendLoading(false);
    }
  }

  const title =
    step === 'phone' ? 'ورود یا ثبت‌نام' : step === 'otp' ? 'تأیید شماره همراه' : 'ورود موفق';

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Trigger asChild>
        <button
          type="button"
          aria-label="ورود یا ثبت‌نام"
          className={cn(
            'inline-flex size-9 items-center justify-center transition-opacity duration-150 hover:opacity-55',
            className,
          )}
        >
          <FiUser aria-hidden="true" size={21} />
        </button>
      </DialogPrimitive.Trigger>

      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="
            fixed inset-0 z-[90] bg-black/45 backdrop-blur-[2px]
            data-[state=closed]:animate-[sf-overlay-close_220ms_ease-in_forwards]
            data-[state=open]:animate-[sf-overlay-open_260ms_ease-out]
          "
        />
        <DialogPrimitive.Content
          dir="rtl"
          aria-describedby="auth-dialog-description"
          className="
            fixed left-1/2 top-1/2 z-[100] w-[min(29rem,calc(100vw-2rem))]
            max-h-[calc(100dvh-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto
            rounded-[0.75rem] border border-[var(--sf-color-border)] bg-[var(--sf-color-canvas)]
            px-5 pb-7 pt-6 shadow-2xl outline-none sm:px-8 sm:pb-9 sm:pt-8
            data-[state=closed]:animate-[sf-auth-modal-close_220ms_ease-in_forwards]
            data-[state=open]:animate-[sf-auth-modal-open_320ms_cubic-bezier(0.16,1,0.3,1)]
          "
        >
          <DialogPrimitive.Close
            aria-label="بستن پنجره ورود"
            className="
              absolute left-4 top-4 inline-flex size-9 items-center justify-center
              rounded-full text-[var(--sf-color-muted)] transition-colors hover:bg-[var(--sf-color-surface)]
              hover:text-[var(--sf-color-ink)]
            "
          >
            <FiX aria-hidden="true" size={20} />
          </DialogPrimitive.Close>

          <div className="flex flex-col items-center text-center">
            <div className="relative h-20 w-48 sm:h-24 sm:w-56">
              <Image
                src="/brand/hamidian-signature.png"
                alt="لوگوی نقره حمیدیان"
                fill
                priority
                sizes="14rem"
                className="object-contain"
              />
            </div>
            <DialogPrimitive.Title className="mt-3 text-xl font-bold sm:text-2xl">
              {title}
            </DialogPrimitive.Title>
            <DialogPrimitive.Description
              id="auth-dialog-description"
              className="mt-2 min-h-6 text-sm leading-6 text-[var(--sf-color-muted)]"
            >
              {step === 'phone'
                ? 'برای ورود یا ساخت حساب، شماره همراه خود را وارد کنید.'
                : step === 'otp'
                  ? `کد ارسال‌شده به ${toPersianDigits(phone)} را وارد کنید.`
                  : 'احراز هویت شما با موفقیت انجام شد.'}
            </DialogPrimitive.Description>
          </div>

          {step === 'phone' ? (
            <form noValidate onSubmit={handlePhoneSubmit} className="mt-7">
              <label htmlFor="auth-phone" className="mb-2 block text-sm font-medium">
                شماره تلفن همراه
              </label>
              <Input
                id="auth-phone"
                name="phone"
                type="tel"
                dir="ltr"
                inputMode="tel"
                autoComplete="tel-national"
                autoFocus
                maxLength={16}
                value={toPersianDigits(phone)}
                invalid={Boolean(phoneError)}
                aria-describedby={phoneError ? 'auth-phone-error' : 'auth-phone-hint'}
                placeholder="۰۹۱۲ ۳۴۵ ۶۷۸۹"
                onChange={(event) => {
                  setPhone(event.target.value);
                  if (phoneError) setPhoneError('');
                }}
                className="min-h-13 text-center text-lg font-medium tracking-wide"
              />
              <p id="auth-phone-hint" className="mt-2 text-xs text-[var(--sf-color-subtle)]">
                نمونه: ۰۹۱۲۳۴۵۶۷۸۹
              </p>
              {phoneError ? <ErrorMessage id="auth-phone-error">{phoneError}</ErrorMessage> : null}
              <Button type="submit" size="lg" loading={phoneLoading} className="mt-6 w-full">
                ارسال کد تأیید
              </Button>
            </form>
          ) : null}

          {step === 'otp' ? (
            <form noValidate onSubmit={handleOtpSubmit} className="mt-6">
              <OtpCountdown expiresAt={expiresAt} />

              <fieldset disabled={otpLoading || resendLoading} className="mt-7">
                <legend className="sr-only">کد تأیید پنج رقمی</legend>
                <OtpCodeInput
                  digits={digits}
                  invalid={Boolean(otpError)}
                  disabled={otpLoading || resendLoading}
                  shakeKey={shakeKey}
                  describedBy={otpError ? 'auth-otp-error' : undefined}
                  onChange={(nextDigits) => {
                    setDigits(nextDigits);
                    if (otpError) setOtpError('');
                  }}
                  onComplete={(code) => void verifyOtp(code)}
                />
              </fieldset>

              {otpError ? <ErrorMessage id="auth-otp-error">{otpError}</ErrorMessage> : null}

              <Button type="submit" size="lg" loading={otpLoading} className="mt-6 w-full">
                تأیید و ورود
              </Button>

              <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-3 text-sm">
                <Button
                  type="button"
                  variant="text"
                  onClick={() => {
                    setStep('phone');
                    setDigits(Array<string>(OTP_LENGTH).fill(''));
                    setOtpError('');
                  }}
                  className="inline-flex items-center gap-1.5 font-medium"
                >
                  <FiEdit2 aria-hidden="true" size={15} />
                  ویرایش شماره همراه
                </Button>

                <Button
                  type="button"
                  variant="text"
                  disabled={remainingSeconds > 0 || resendLoading}
                  onClick={handleResend}
                  className="
                    inline-flex items-center gap-1.5 font-medium
                    disabled:cursor-not-allowed disabled:text-[var(--sf-color-subtle)]
                  "
                >
                  <FiRefreshCw
                    aria-hidden="true"
                    size={15}
                    className={resendLoading ? 'animate-spin' : undefined}
                  />
                  {resendLoading ? 'در حال ارسال...' : 'درخواست مجدد کد'}
                </Button>
              </div>
            </form>
          ) : null}

          {step === 'success' ? <SuccessState digits={digits} /> : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
