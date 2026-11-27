'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { DualCalendarPicker } from '@/components/ui/dual-calendar-picker';
import { calendarDayMilliseconds, readCalendarValue } from '@/lib/presentation/dual-calendar';

export function CampaignReportPeriod({
  path,
  from,
  to,
  children,
}: {
  path: string;
  from: string;
  to: string;
  children?: ReactNode;
}) {
  const [error, setError] = useState<string | null>(null);

  function validate(event: FormEvent<HTMLFormElement>) {
    const values = new FormData(event.currentTarget);
    const start = readCalendarValue(String(values.get('from') ?? ''), 'date');
    const end = readCalendarValue(String(values.get('to') ?? ''), 'date');
    if (
      !start ||
      !end ||
      end.day < start.day ||
      end.day - start.day >= 92 * calendarDayMilliseconds
    ) {
      event.preventDefault();
      setError('بازه‌ای از روز آغاز تا پایان انتخاب کنید. بازه می‌تواند حداکثر ۹۲ روز باشد.');
    }
  }

  return (
    <form action={path} onSubmit={validate} className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <DualCalendarPicker
          kind="date"
          name="from"
          label="از روز"
          defaultValue={from}
          onChange={() => setError(null)}
          required
        />
        <DualCalendarPicker
          kind="date"
          name="to"
          label="تا روز"
          defaultValue={to}
          onChange={() => setError(null)}
          required
        />
        {!children && <Button type="submit">نمایش گزارش</Button>}
      </div>
      {children && (
        <>
          {children}
          <Button type="submit">نمایش گزارش</Button>
        </>
      )}
      {error && <Alert tone="danger">{error}</Alert>}
    </form>
  );
}
