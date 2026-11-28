'use client';

import { useState } from 'react';
import { TableScrollRegion } from '@/components/ui/data-table';
import { Select } from '@/components/ui/select';
import { growthTrendPoints, type GrowthDashboardDay } from '@/lib/growth/growth-report';
import {
  formatAdminInteger,
  formatAdminToman,
  toPersianDigits,
} from '@/lib/presentation/formatters';

const intervals = { day: 'روزانه', week: 'هفتگی', month: 'ماهانه' } as const;
const trends = {
  collectedToman: 'وصول قطعی',
  netCollectedToman: 'وصول خالص',
  confirmedOrders: 'خرید تأییدشده',
  newCustomers: 'خریدار جدید',
  orderDiscountToman: 'تخفیف خرید قطعی',
  walletAppliedToman: 'اعتبار مصرف‌شده',
  campaignAttributedOrders: 'خرید منتسب به کمپین',
} satisfies Record<keyof Omit<GrowthDashboardDay, 'day'>, string>;

const selectClass =
  'rounded-md border border-[var(--admin-color-border)] bg-[var(--admin-color-surface)] p-2';

export function GrowthDashboardTrend({ daily }: { daily: readonly GrowthDashboardDay[] }) {
  const [interval, setInterval] = useState<keyof typeof intervals>('day');
  const [metric, setMetric] = useState<keyof typeof trends>('collectedToman');
  const points = growthTrendPoints(daily, interval, metric);
  const values = points.map(({ value }) => value ?? 0);
  const low = Math.min(0, ...values);
  const high = Math.max(0, ...values);
  const range = high - low || 1;
  const zero = (-low / range) * 100;
  const format = metric.endsWith('Toman') ? formatAdminToman : formatAdminInteger;
  const show = (value: number | null) => (value === null ? 'پوشش ناقص' : format(value));
  const dateLabel = (from: string, to: string) =>
    from === to ? toPersianDigits(from) : `${toPersianDigits(from)} تا ${toPersianDigits(to)}`;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 text-sm">
        <label className="grid gap-1">
          فاصلهٔ زمانی
          <Select
            className={selectClass}
            value={interval}
            onValueChange={(value) => setInterval(value as keyof typeof intervals)}
            aria-label="فاصلهٔ زمانی"
            options={Object.entries(intervals).map(([key, name]) => ({ value: key, label: name }))}
          />
        </label>
        <label className="grid gap-1">
          شاخص روند
          <Select
            className={selectClass}
            value={metric}
            onValueChange={(value) => setMetric(value as keyof typeof trends)}
            aria-label="شاخص روند"
            options={Object.entries(trends).map(([key, name]) => ({ value: key, label: name }))}
          />
        </label>
      </div>
      {points.some(({ value }) => value !== null && value !== 0) ? (
        <div className="overflow-x-auto" aria-hidden="true">
          <div
            dir="ltr"
            className="relative flex h-36 gap-1"
            style={{ minWidth: points.length * 8 }}
          >
            <div
              className="absolute inset-x-0 border-b border-[var(--admin-color-border)]"
              style={{ bottom: `${zero}%` }}
            />
            {points.map(({ from, to, value }) => (
              <div
                key={from}
                className="relative min-w-1 flex-1"
                title={`${dateLabel(from, to)} · ${show(value)}`}
              >
                <span
                  className={
                    value === null
                      ? 'absolute inset-x-0 border-t-2 border-dashed border-[var(--admin-color-muted)]'
                      : 'absolute inset-x-0 rounded-sm bg-[var(--admin-color-primary)]'
                  }
                  style={{
                    bottom: `${((Math.min(0, value ?? 0) - low) / range) * 100}%`,
                    height:
                      value === null || value === 0
                        ? '1px'
                        : `max(1px, ${(Math.abs(value) / range) * 100}%)`,
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm">
          {points.some(({ value }) => value === null)
            ? 'پوشش این شاخص برای نمایش روند کامل نیست.'
            : 'در این بازه حرکتی برای این شاخص ثبت نشده است.'}
        </p>
      )}
      <details className="space-y-2 text-sm">
        <summary className="cursor-pointer underline">جدول داده‌های روند</summary>
        <TableScrollRegion label="جدول داده‌های روند رشد">
          <table className="w-full text-start">
            <thead>
              <tr>
                <th scope="col" className="text-start">
                  بازه
                </th>
                <th scope="col" className="text-start">
                  {trends[metric]}
                </th>
              </tr>
            </thead>
            <tbody>
              {points.map(({ from, to, value }) => (
                <tr key={from} className="border-b border-[var(--admin-color-border)]">
                  <td className="py-2">{dateLabel(from, to)}</td>
                  <td>{show(value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScrollRegion>
      </details>
    </div>
  );
}
