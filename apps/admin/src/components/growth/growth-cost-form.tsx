'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { DualCalendarPicker } from '@/components/ui/dual-calendar-picker';
import { Input } from '@/components/ui/form-control';
import type { GrowthCostInput } from '@/lib/growth/growth-report';
import { readCalendarValue } from '@/lib/presentation/dual-calendar';
import { toAsciiDigits } from '@/lib/presentation/formatters';

type Defaults = Readonly<{ day: string; campaignId?: string; source?: string; medium?: string }>;

export function GrowthCostForm({ defaults }: Readonly<{ defaults: Defaults }>) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [day, setDay] = useState(defaults.day);
  const attempt = useRef<{ values: string; id: string } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const read = (key: string) => String(form.get(key) ?? '').trim();
    const rawAmount = toAsciiDigits(read('amountToman')).replace(/[٬,]/g, '').replace('−', '-');
    const amountToman = Number(rawAmount);
    setSaved(false);
    setError('');
    const recordedDay = read('day');
    if (!readCalendarValue(recordedDay, 'date')) {
      setError('روز ثبت هزینه را انتخاب کنید.');
      return;
    }
    if (
      !/^-?\d+$/.test(rawAmount) ||
      !Number.isInteger(amountToman) ||
      amountToman === 0 ||
      Math.abs(amountToman) > 2147483647
    ) {
      setError('مبلغ را به تومان و به‌صورت عدد صحیحِ غیرصفر وارد کنید.');
      return;
    }
    const values = {
      day: recordedDay,
      campaignId: read('campaignId').toLowerCase(),
      source: read('source').toLowerCase(),
      medium: read('medium').toLowerCase(),
      note: read('note') || undefined,
      amountToman,
    };
    const fingerprint = JSON.stringify(values);
    if (attempt.current?.values !== fingerprint) {
      attempt.current = { values: fingerprint, id: window.crypto.randomUUID() };
    }
    const input: GrowthCostInput = { id: attempt.current.id, ...values };
    setBusy(true);
    try {
      const response = await fetch('/api/growth/costs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (response.status === 400) {
        setError('شناسهٔ کمپین موجود، روز، منبع، کانال و مبلغ را بررسی کنید.');
        return;
      }
      if (!response.ok) throw new Error('Cost could not be saved.');
      setSaved(true);
      attempt.current = null;
      formElement.reset();
      setDay(defaults.day);
      router.refresh();
    } catch {
      setError('نتیجهٔ ثبت هزینه مشخص نیست. برای پیگیری، همان اطلاعات را دوباره ارسال کنید.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="mt-4 space-y-3">
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {saved ? <Alert tone="success">هزینه ثبت شد.</Alert> : null}
      <fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <DualCalendarPicker
          kind="date"
          label="روز هزینه"
          name="day"
          value={day}
          onChange={setDay}
          required
        />
        <label className="text-sm">
          شناسهٔ کمپین
          <Input
            name="campaignId"
            dir="ltr"
            maxLength={64}
            defaultValue={defaults.campaignId}
            required
          />
        </label>
        <label className="text-sm">
          منبع
          <Input name="source" dir="ltr" maxLength={96} defaultValue={defaults.source} required />
        </label>
        <label className="text-sm">
          کانال
          <Input name="medium" dir="ltr" maxLength={96} defaultValue={defaults.medium} required />
        </label>
        <label className="text-sm">
          مبلغ به تومان
          <Input name="amountToman" dir="ltr" inputMode="text" maxLength={16} required />
        </label>
        <label className="text-sm">
          یادداشت
          <Input name="note" maxLength={160} />
        </label>
      </fieldset>
      <p className="text-xs text-[var(--admin-color-muted)]">
        برای اصلاح هزینهٔ قبلی، یک ثبت جدا با مبلغ جبرانی وارد کنید.
      </p>
      <Button type="submit" loading={busy}>
        ثبت هزینه
      </Button>
    </form>
  );
}
