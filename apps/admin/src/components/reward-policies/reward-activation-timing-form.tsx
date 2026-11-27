'use client';

import { useRef, useState, type FormEvent } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/form-control';
import { FormField } from '@/components/ui/form-field';
import { formatAdminInteger, toAsciiDigits } from '@/lib/presentation/formatters';
import {
  parseRewardActivationTiming,
  type RewardActivationTiming,
} from '@/lib/reward-policies/activation-timing';

const modes = [
  { value: 'scheduled', label: 'بعد از تعداد روز مشخص' },
  { value: 'immediate', label: 'بلافاصله پس از تحویل' },
];

function readDays(input: string): number | null {
  const value = toAsciiDigits(input.trim());
  if (!/^\d+$/.test(value)) return null;
  const days = Number(value);
  return days >= 1 && days <= 3_650 ? days : null;
}

export function RewardActivationTimingForm({
  initialTiming,
  canWrite,
}: Readonly<{
  initialTiming: RewardActivationTiming;
  canWrite: boolean;
}>) {
  const [timing, setTiming] = useState(initialTiming);
  const [mode, setMode] = useState(timing.activationDelayDays === 0 ? 'immediate' : 'scheduled');
  const [days, setDays] = useState(
    timing.activationDelayDays ? String(timing.activationDelayDays) : '',
  );
  const [expiryInput, setExpiryInput] = useState(String(initialTiming.expiryDays));
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);
  const request = useRef<{
    requestId: string;
    activationDelayDays: number;
    expiryDays: number;
  } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || conflict) return;
    const activationDelayDays = mode === 'immediate' ? 0 : readDays(days);
    const expiryDays = readDays(expiryInput);
    setError('');
    setSaved(false);
    if (activationDelayDays === null || expiryDays === null) {
      setError('زمان فعال‌سازی و مهلت مصرف را با عدد صحیح بین ۱ و ۳۶۵۰ وارد کنید.');
      return;
    }
    if (
      request.current?.activationDelayDays !== activationDelayDays ||
      request.current?.expiryDays !== expiryDays
    ) {
      request.current = { requestId: crypto.randomUUID(), activationDelayDays, expiryDays };
    }

    setBusy(true);
    try {
      const response = await fetch('/api/reward-policies/activation-timing', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...request.current, expectedPolicyVersion: timing.policyVersion }),
      });
      if (response.status === 409) {
        setConflict(true);
        setError('نسخهٔ سیاست تغییر کرده است. تنظیم فعال را دوباره بارگیری کنید.');
        return;
      }
      if (response.status === 400) {
        setError('تعداد روز باید بین ۱ و ۳۶۵۰ باشد.');
        return;
      }
      if (response.status === 401 || response.status === 403) {
        setError('برای ذخیرهٔ تنظیمات به نشست فعال و مجوز تغییر مالی نیاز دارید.');
        return;
      }
      const updated = response.ok ? parseRewardActivationTiming(await response.json()) : null;
      if (!updated) throw new Error('Could not save reward activation timing.');
      request.current = null;
      setTiming(updated);
      setSaved(true);
    } catch {
      setError('نتیجهٔ ذخیره مشخص نیست. برای پیگیری، همان مقدار را دوباره ارسال کنید.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="فعال‌سازی و انقضای پاداش" className="max-w-2xl">
      <div className="space-y-4">
        <p className="text-sm">
          زمان فعال فعلی{' '}
          <strong>
            {timing.activationDelayDays === 0
              ? 'بلافاصله پس از تحویل'
              : `${formatAdminInteger(timing.activationDelayDays)} روز پس از تحویل`}
          </strong>
        </p>
        <p className="text-sm">
          مهلت مصرف فعلی از زمان صدور اعتبار{' '}
          <strong>{formatAdminInteger(timing.expiryDays)} روز</strong>
        </p>
        <p className="text-sm leading-6 text-[var(--admin-color-muted)]">
          درخواست مرجوعی باز، فعال‌سازی را تا تعیین تکلیف آن به تعویق می‌اندازد.
        </p>
        {canWrite && (
          <form onSubmit={(event) => void submit(event)} className="space-y-4">
            <fieldset disabled={busy || conflict} className="space-y-4">
              <fieldset className="space-y-2">
                <legend className="text-sm font-semibold">زمان فعال‌سازی</legend>
                {modes.map(({ value, label }) => (
                  <label key={value} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="activation-mode"
                      value={value}
                      checked={mode === value}
                      onChange={() => setMode(value)}
                    />
                    {label}
                  </label>
                ))}
              </fieldset>
              {mode === 'scheduled' && (
                <FormField id="reward-activation-days" label="تعداد روز پس از تحویل" required>
                  {(props) => (
                    <Input
                      {...props}
                      value={days}
                      onChange={(event) => setDays(event.target.value)}
                      inputMode="numeric"
                      maxLength={4}
                      required
                    />
                  )}
                </FormField>
              )}
              <FormField
                id="reward-expiry-days"
                label="مهلت مصرف از صدور اعتبار به روز"
                hint="این مقدار برای بسته‌های جدید طبق نسخهٔ سیاستِ سفارش اعمال می‌شود."
                required
              >
                {(props) => (
                  <Input
                    {...props}
                    value={expiryInput}
                    onChange={(event) => setExpiryInput(event.target.value)}
                    inputMode="numeric"
                    maxLength={4}
                    required
                  />
                )}
              </FormField>
              <Button type="submit" loading={busy}>
                ذخیره و انتشار
              </Button>
            </fieldset>
            {error && <Alert tone="danger">{error}</Alert>}
            {conflict && (
              <ButtonLink href="/reward-policies" variant="outline">
                بارگیری تنظیم فعال
              </ButtonLink>
            )}
            {saved && <Alert tone="success">زمان‌بندی پاداش ذخیره شد.</Alert>}
          </form>
        )}
      </div>
    </Card>
  );
}
