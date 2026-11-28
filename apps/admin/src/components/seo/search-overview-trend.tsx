'use client';

import { useState } from 'react';
import { Select } from '@/components/ui/select';
import type { OverviewMetrics, OverviewPeriod } from '@/lib/seo/search-overview-model';
import { displaySearchMetric, overviewMetrics } from '@/lib/seo/search-overview-model';
import { toPersianDigits } from '@/lib/presentation/formatters';

export function SearchOverviewTrend({
  daily,
  weekly,
}: Readonly<{ daily: OverviewPeriod[]; weekly?: OverviewPeriod[] }>) {
  const [interval, setInterval] = useState<'daily' | 'weekly'>('daily');
  const [metric, setMetric] = useState<keyof OverviewMetrics>('clicks');
  const points = interval === 'weekly' && weekly ? weekly : daily;
  const maximum = Math.max(1, ...points.map((point) => point.metrics?.[metric] ?? 0));
  const show = (point: OverviewPeriod) => displaySearchMetric(metric, point.metrics?.[metric]);
  const period = (point: OverviewPeriod) =>
    toPersianDigits(
      point.startDate === point.endDate
        ? point.startDate
        : `${point.startDate} تا ${point.endDate}`,
    );
  const metricName = overviewMetrics.find(([key]) => key === metric)?.[1];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 text-sm">
        {weekly ? (
          <label className="grid gap-1">
            فاصلهٔ نمودار
            <Select
              value={interval}
              onValueChange={(value) => setInterval(value === 'weekly' ? 'weekly' : 'daily')}
              className="rounded border border-[var(--admin-color-border)] bg-[var(--admin-color-surface)] p-2"
              aria-label="فاصلهٔ نمودار"
              options={[
                { value: 'daily', label: 'روزانه' },
                { value: 'weekly', label: 'هفتگی' },
              ]}
            />
          </label>
        ) : null}
        <label className="grid gap-1">
          شاخص نمودار
          <Select
            value={metric}
            onValueChange={(value) => setMetric(value as keyof OverviewMetrics)}
            className="rounded border border-[var(--admin-color-border)] bg-[var(--admin-color-surface)] p-2"
            aria-label="شاخص نمودار"
            options={overviewMetrics.map(([key, name]) => ({ value: key, label: name }))}
          />
        </label>
      </div>
      <div className="overflow-x-auto" aria-hidden="true">
        <div
          dir="ltr"
          className="border-b border-[var(--admin-color-border)]"
          style={{ minWidth: points.length * 12 }}
        >
          <div className="flex h-40 items-end gap-1">
            {points.map((point) => {
              const value = point.metrics?.[metric];
              const incomplete = point.dataDays < point.days;
              return (
                <div
                  key={point.startDate}
                  title={`${period(point)} · ${show(point)}${incomplete ? ' · پوشش ناقص' : ''}`}
                  className={
                    value == null
                      ? 'min-w-2 flex-1 rounded-t bg-[var(--admin-color-border)]'
                      : `min-w-2 flex-1 rounded-t bg-[var(--admin-color-primary)] ${incomplete ? 'opacity-50' : ''}`
                  }
                  style={{
                    height: value == null ? '0.3rem' : `max(2px, ${(value / maximum) * 100}%)`,
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>
      <div
        className="flex flex-wrap justify-between gap-2 text-xs text-[var(--admin-color-muted)]"
        dir="ltr"
        aria-hidden="true"
      >
        <span>{toPersianDigits(points[0].startDate)}</span>
        <span>{toPersianDigits(points[points.length - 1].endDate)}</span>
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer underline">جدول داده‌های نمودار</summary>
        <table className="mt-3 w-full text-start">
          <thead>
            <tr>
              <th scope="col">بازه</th>
              <th scope="col">{metricName}</th>
              <th scope="col">روزهای دارای داده</th>
            </tr>
          </thead>
          <tbody>
            {points.map((point) => (
              <tr key={point.startDate} className="border-b border-[var(--admin-color-border)]">
                <td className="py-2">{period(point)}</td>
                <td>{show(point)}</td>
                <td>
                  {toPersianDigits(point.dataDays)} از {toPersianDigits(point.days)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
