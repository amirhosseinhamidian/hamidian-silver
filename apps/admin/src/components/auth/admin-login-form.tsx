'use client';

import { useRouter } from 'next/navigation';
import {
  type ChangeEvent,
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form-control';
import { toAsciiDigits, toPersianDigits } from '@/lib/presentation/formatters';
import { cn } from '@/lib/ui/cn';

const OTP_LENGTH = 5;
const OTP_LIFETIME_SECONDS = 120;
const SUCCESS_DELAY_MS = 650;

type LoginStep = 'phone' | 'otp' | 'success';
type RequestAction = 'request' | 'verify';

type OtpRequestResponse = Readonly<{
  challengeId: string;
  expiresAt: string;
}>;

type ApiErrorPayload = Readonly<{
  error?: { code?: string; message?: string };
  message?: string;
}>;

class LoginRequestError extends Error {
  constructor(
    readonly status: number,
    readonly payload: ApiErrorPayload | null,
  ) {
    super(payload?.error?.message ?? payload?.message ?? 'Authentication request failed.');
    this.name = 'LoginRequestError';
  }
}

function normalizePhoneInput(value: string): string {
  const digits = toAsciiDigits(value).replace(/\D/g, '');

  if (digits.startsWith('0098')) return `0${digits.slice(4)}`;
  if (digits.startsWith('98')) return `0${digits.slice(2)}`;
  if (digits.length === 10 && digits.startsWith('9')) return `0${digits}`;
  return digits;
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
    throw new LoginRequestError(response.status, payload as ApiErrorPayload | null);
  }

  return payload as T;
}

function requestErrorMessage(error: unknown, action: RequestAction): string {
  if (error instanceof LoginRequestError) {
    if (error.status === 429) {
      return 'تعداد درخواست‌ها زیاد است؛ کمی صبر کنید و دوباره تلاش کنید.';
    }

    if (error.status === 401 && action === 'verify') {
      return 'کد واردشده اشتباه است یا اعتبار آن به پایان رسیده است.';
    }

    if (error.status === 403) {
      return 'این حساب اجازه ورود به پنل مدیریت را ندارد.';
    }

    if (error.status === 400 || error.status === 422) {
      return action === 'request'
        ? 'شماره همراه معتبر نیست؛ شماره را بررسی کنید.'
        : 'کد تأیید معتبر نیست.';
    }

    if (error.status >= 500) {
      return 'سرویس ورود موقتاً در دسترس نیست؛ چند لحظه دیگر دوباره تلاش کنید.';
    }
  }

  if (error instanceof Error && error.message === 'NETWORK_ERROR') {
    return 'ارتباط با سرور برقرار نشد؛ اتصال اینترنت را بررسی کنید.';
  }

  return 'خطایی رخ داد؛ لطفاً دوباره تلاش کنید.';
}

function getExpiryTimestamp(expiresAt: string): number {
  const timestamp = new Date(expiresAt).getTime();
  return Number.isFinite(timestamp) ? timestamp : Date.now() + OTP_LIFETIME_SECONDS * 1000;
}

export function AdminLoginForm({ nextPath }: Readonly<{ nextPath: string }>) {
  const router = useRouter();
  const [step, setStep] = useState<LoginStep>('phone');
  const [phoneInput, setPhoneInput] = useState('');
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

    const timeout = window.setTimeout(() => {
      router.replace(nextPath);
      router.refresh();
    }, SUCCESS_DELAY_MS);

    return () => window.clearTimeout(timeout);
  }, [nextPath, router, step]);

  async function handlePhoneSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (phoneLoading) return;

    const normalizedPhone = normalizePhoneInput(phoneInput);

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

      setPhone(normalizedPhone);
      setPhoneInput(normalizedPhone);
      setExpiresAt(getExpiryTimestamp(response.expiresAt));
      setRemainingSeconds(OTP_LIFETIME_SECONDS);
      setDigits(Array<string>(OTP_LENGTH).fill(''));
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
      setOtpError('کد تأیید پنج‌رقمی را کامل وارد کنید.');
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
      setDigits(Array<string>(OTP_LENGTH).fill(''));
      setExpiresAt(getExpiryTimestamp(response.expiresAt));
      setRemainingSeconds(OTP_LIFETIME_SECONDS);
    } catch (error) {
      setOtpError(requestErrorMessage(error, 'request'));
    } finally {
      setResendLoading(false);
    }
  }

  function editPhone() {
    setStep('phone');
    setDigits(Array<string>(OTP_LENGTH).fill(''));
    setOtpError('');
    setExpiresAt(0);
  }

  return (
    <div className="rounded-2xl border border-[var(--admin-color-border)] bg-[var(--admin-color-surface)] p-5 shadow-[var(--admin-shadow-md)] sm:p-7">
      <div className="admin-auth-step" key={step}>
        <div>
          <p className="text-xs font-bold text-[var(--admin-color-primary)]">ورود امن</p>
          <h2 className="mt-2 text-xl font-bold sm:text-2xl">
            {step === 'phone'
              ? 'ورود به پنل مدیریت'
              : step === 'otp'
                ? 'تأیید شماره همراه'
                : 'ورود موفق'}
          </h2>
          <p className="mt-2 min-h-6 text-sm leading-6 text-[var(--admin-color-muted)]">
            {step === 'phone'
              ? 'شماره همراه حساب مدیریتی خود را وارد کنید.'
              : step === 'otp'
                ? `کد ارسال‌شده به ${toPersianDigits(phone)} را وارد کنید.`
                : 'در حال انتقال به پنل مدیریت هستید.'}
          </p>
        </div>

        {step === 'phone' ? (
          <form noValidate onSubmit={handlePhoneSubmit} className="mt-6">
            <label htmlFor="admin-login-phone" className="mb-2 block text-xs font-semibold">
              شماره تلفن همراه
              <span aria-hidden="true" className="text-[var(--admin-color-danger)]">
                {' *'}
              </span>
            </label>
            <Input
              id="admin-login-phone"
              name="phone"
              type="tel"
              dir="ltr"
              inputMode="tel"
              autoComplete="tel-national"
              autoFocus
              maxLength={16}
              value={toPersianDigits(phoneInput)}
              invalid={Boolean(phoneError)}
              aria-describedby={phoneError ? 'admin-login-phone-error' : 'admin-login-phone-hint'}
              placeholder="۰۹۱۲ ۳۴۵ ۶۷۸۹"
              onChange={(event) => {
                setPhoneInput(toAsciiDigits(event.target.value).replace(/[^\d+]/g, ''));
                if (phoneError) setPhoneError('');
              }}
              className="min-h-12 text-center text-base font-semibold tracking-wide"
            />
            <p
              id="admin-login-phone-hint"
              className="mt-2 text-xs text-[var(--admin-color-subtle)]"
            >
              فقط حساب‌های دارای دسترسی مدیریت امکان ورود دارند.
            </p>
            {phoneError ? (
              <Alert id="admin-login-phone-error" tone="danger" className="mt-4">
                {phoneError}
              </Alert>
            ) : null}
            <Button type="submit" size="lg" loading={phoneLoading} className="mt-6 w-full">
              ارسال کد تأیید
            </Button>
          </form>
        ) : null}

        {step === 'otp' ? (
          <form noValidate onSubmit={handleOtpSubmit} className="mt-5">
            <OtpCountdown remainingSeconds={remainingSeconds} />
            <fieldset disabled={otpLoading || resendLoading} className="mt-6">
              <legend className="sr-only">کد تأیید پنج‌رقمی</legend>
              <OtpCodeInput
                digits={digits}
                invalid={Boolean(otpError)}
                disabled={otpLoading || resendLoading}
                shakeKey={shakeKey}
                describedBy={otpError ? 'admin-login-otp-error' : undefined}
                onChange={(nextDigits) => {
                  setDigits(nextDigits);
                  if (otpError) setOtpError('');
                }}
                onComplete={(code) => void verifyOtp(code)}
              />
            </fieldset>

            {otpError ? (
              <Alert id="admin-login-otp-error" tone="danger" className="mt-4">
                {otpError}
              </Alert>
            ) : null}

            <Button type="submit" size="lg" loading={otpLoading} className="mt-5 w-full">
              تأیید و ورود
            </Button>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={otpLoading || resendLoading}
                onClick={editPhone}
              >
                ویرایش شماره
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={remainingSeconds > 0 || otpLoading || resendLoading}
                loading={resendLoading}
                onClick={handleResend}
              >
                ارسال مجدد کد
              </Button>
            </div>
          </form>
        ) : null}

        {step === 'success' ? <LoginSuccess /> : null}
      </div>
    </div>
  );
}

function OtpCountdown({ remainingSeconds }: Readonly<{ remainingSeconds: number }>) {
  const radius = 25;
  const circumference = 2 * Math.PI * radius;
  const progress = remainingSeconds / OTP_LIFETIME_SECONDS;
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const time = toPersianDigits(
    `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`,
  );

  return (
    <div className="flex items-center justify-between gap-4 rounded-xl bg-[var(--admin-color-surface-subtle)] p-3">
      <div>
        <p className="text-xs font-semibold">زمان باقی‌مانده</p>
        <p className="mt-1 text-[0.6875rem] text-[var(--admin-color-muted)]">
          پس از پایان زمان می‌توانید کد جدید بگیرید.
        </p>
      </div>
      <div
        role="timer"
        aria-label={`زمان باقی‌مانده ${time}`}
        className="relative grid size-16 shrink-0 place-items-center"
      >
        <svg aria-hidden="true" viewBox="0 0 60 60" className="absolute inset-0 -rotate-90">
          <circle cx="30" cy="30" r={radius} fill="none" stroke="#d8dee8" strokeWidth="4" />
          <circle
            cx="30"
            cy="30"
            r={radius}
            fill="none"
            stroke="var(--admin-color-primary)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - progress)}
            className="transition-[stroke-dashoffset] duration-300 ease-linear"
          />
        </svg>
        <span dir="ltr" className="text-xs font-bold tabular-nums">
          {time}
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
    inputs.current[Math.min(index + incoming.length, OTP_LENGTH - 1)]?.focus();
    if (next.every(Boolean)) onComplete(next.join(''));
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    const pasted = normalizeOtpInput(event.clipboardData.getData('text'));
    if (!pasted) return;

    event.preventDefault();
    const next = Array.from({ length: OTP_LENGTH }, (_, index) => pasted[index] ?? '');
    onChange(next);
    inputs.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus();
    if (next.every(Boolean)) onComplete(next.join(''));
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
      data-testid="admin-otp-inputs"
      className={cn('flex justify-between gap-2', invalid && 'admin-auth-otp-error')}
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
          aria-label={`رقم ${toPersianDigits(index + 1)} از ${toPersianDigits(OTP_LENGTH)}`}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          autoFocus={index === 0}
          onChange={(event: ChangeEvent<HTMLInputElement>) => commitFrom(index, event.target.value)}
          onPaste={handlePaste}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onFocus={(event) => event.currentTarget.select()}
          className="size-12 rounded-lg border border-[var(--admin-color-border)] bg-[var(--admin-color-surface)] text-center text-2xl leading-none font-black tabular-nums outline-none transition-[border-color,box-shadow,transform] focus:border-[var(--admin-color-primary)] focus:shadow-[var(--admin-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60 sm:size-14 sm:text-3xl aria-[invalid=true]:border-[var(--admin-color-danger)]"
        />
      ))}
    </div>
  );
}

function LoginSuccess() {
  return (
    <div role="status" className="py-8 text-center text-[var(--admin-color-success)]">
      <span className="admin-auth-success-check mx-auto grid size-16 place-items-center rounded-full bg-[var(--admin-color-success)] text-white">
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-9" fill="none">
          <path
            d="m5 12.5 4.2 4.2L19 7"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <p className="mt-4 text-lg font-bold">ورود با موفقیت انجام شد</p>
    </div>
  );
}
