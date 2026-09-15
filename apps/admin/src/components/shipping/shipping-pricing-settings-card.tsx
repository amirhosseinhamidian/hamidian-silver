'use client';

import { useState, type FormEvent } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { FormField } from '@/components/ui/form-field';
import { MoneyInput } from '@/components/ui/money-input';
import { Select } from '@/components/ui/select';
import {
  formatAdminDateTime,
  parseAdminMoneyInput,
  toPersianDigits,
} from '@/lib/presentation/formatters';
import type { ShippingPricingData } from '@/lib/shipping/shipping-pricing-data';
import {
  parseAdminShippingPricingSettings,
  type AdminShippingPricingSettings,
  type ShippingPricingMode,
} from '@/lib/shipping/shipping-pricing-model';

type Props = Readonly<{ data: ShippingPricingData | null; canRead: boolean; canWrite: boolean }>;

function initialMoney(value: number | null): string {
  return value === null ? '' : toPersianDigits(value);
}

function errorMessage(status: number): string {
  if (status === 401) return 'نشست مدیریتی منقضی شده است. دوباره وارد شوید.';
  if (status === 403) return 'مجوز تغییر تنظیمات ارسال را ندارید.';
  if (status === 400 || status === 422) return 'مقادیر هزینه و شرط ارسال معتبر نیستند.';
  return 'ذخیره تنظیمات ارسال انجام نشد. دوباره تلاش کنید.';
}

export function ShippingPricingSettingsCard({ data, canRead, canWrite }: Props) {
  const initial = data?.settings;
  const [settings, setSettings] = useState<AdminShippingPricingSettings | null>(initial ?? null);
  const [mode, setMode] = useState<ShippingPricingMode>(initial?.mode ?? 'FREE');
  const [baseCost, setBaseCost] = useState(initialMoney(initial?.baseCostToman ?? 0));
  const [thresholdEnabled, setThresholdEnabled] = useState(initial?.thresholdToman !== null);
  const [threshold, setThreshold] = useState(initialMoney(initial?.thresholdToman ?? null));
  const [discountedCost, setDiscountedCost] = useState(
    initialMoney(initial?.discountedCostToman ?? null),
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite || pending) return;
    const base = mode === 'FREE' ? 0 : parseAdminMoneyInput(baseCost);
    const limit = thresholdEnabled ? parseAdminMoneyInput(threshold) : null;
    const reduced = thresholdEnabled ? parseAdminMoneyInput(discountedCost) : null;
    if (mode === 'FIXED' && (base === null || base <= 0))
      return setError('هزینه ثابت ارسال باید بیشتر از صفر باشد.');
    if (thresholdEnabled && (limit === null || limit <= 0 || reduced === null))
      return setError('حداقل سبد خرید و هزینه ارسال بعد از آن را کامل وارد کنید.');
    if (thresholdEnabled && base !== null && reduced !== null && reduced >= base)
      return setError(
        'هزینه شرطی باید از هزینه ثابت ارسال کمتر باشد؛ برای ارسال رایگان صفر بزنید.',
      );
    setPending(true);
    setError('');
    setSuccess('');
    try {
      const response = await fetch('/api/shipping/pricing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          baseCostToman: base ?? 0,
          thresholdToman: mode === 'FIXED' ? limit : null,
          discountedCostToman: mode === 'FIXED' ? reduced : null,
        }),
      });
      if (!response.ok) return setError(errorMessage(response.status));
      const payload = parseAdminShippingPricingSettings(await response.json());
      if (!payload)
        return setError('تنظیمات ذخیره شد اما پاسخ سرویس معتبر نبود. صفحه را تازه کنید.');
      setSettings(payload);
      setSuccess('تنظیمات هزینه ارسال ذخیره شد.');
    } catch {
      setError(errorMessage(502));
    } finally {
      setPending(false);
    }
  }

  if (!canRead) {
    return (
      <Card title="تنظیمات هزینه ارسال" description="روش محاسبه هزینه ارسال">
        <Alert tone="neutral">برای مشاهده این بخش به مجوز خواندن تنظیمات نیاز دارید.</Alert>
      </Card>
    );
  }
  if (data?.failed || !settings) {
    return (
      <Card title="تنظیمات هزینه ارسال" description="روش محاسبه هزینه ارسال">
        <Alert tone="danger">
          دریافت تنظیمات هزینه ارسال انجام نشد. صفحه را دوباره بارگذاری کنید.
        </Alert>
      </Card>
    );
  }

  return (
    <Card title="تنظیمات هزینه ارسال" description="هزینه ارسال سفارش‌ها را مدیریت کنید.">
      <form onSubmit={(event) => void submit(event)} className="space-y-5">
        {settings.source === 'ENVIRONMENT' ? (
          <Alert tone="info">
            مقدار فعلی از تنظیمات محیطی خوانده شده است؛ با اولین ذخیره، مدیریت آن به پنل منتقل
            می‌شود.
          </Alert>
        ) : settings.updatedAt ? (
          <Alert tone="neutral">آخرین تغییر: {formatAdminDateTime(settings.updatedAt)}</Alert>
        ) : null}
        {error ? <Alert tone="danger">{error}</Alert> : null}
        {success ? <Alert tone="success">{success}</Alert> : null}

        <div className="grid gap-4 md:grid-cols-2">
          <FormField id="shipping-pricing-mode" label="روش محاسبه" required>
            {(props) => (
              <Select
                {...props}
                value={mode}
                options={[
                  { value: 'FREE', label: 'ارسال رایگان' },
                  { value: 'FIXED', label: 'هزینه ثابت' },
                ]}
                disabled={!canWrite || pending}
                onValueChange={(value) => {
                  const nextMode = value as ShippingPricingMode;
                  setMode(nextMode);
                  setError('');
                  if (nextMode === 'FREE') setThresholdEnabled(false);
                }}
              />
            )}
          </FormField>
          {mode === 'FIXED' ? (
            <FormField id="shipping-base-cost" label="هزینه ثابت ارسال (تومان)" required>
              {(props) => (
                <MoneyInput
                  {...props}
                  value={baseCost}
                  disabled={!canWrite || pending}
                  placeholder="مثلاً ۸۵٬۰۰۰"
                  required
                  onChange={(event) => setBaseCost(event.target.value)}
                />
              )}
            </FormField>
          ) : null}
        </div>

        {mode === 'FIXED' ? (
          <div className="rounded-[var(--admin-radius-md)] border border-[var(--admin-color-border)] p-4">
            <Checkbox
              id="shipping-threshold-enabled"
              checked={thresholdEnabled}
              disabled={!canWrite || pending}
              label="کاهش هزینه برای سبدهای بزرگ‌تر"
              description="پس از رسیدن مبلغ سبد به حد مشخص، ارسال رایگان یا ارزان‌تر می‌شود."
              onChange={(event) => {
                setThresholdEnabled(event.target.checked);
                setError('');
              }}
            />
            {thresholdEnabled ? (
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <FormField id="shipping-threshold" label="حداقل مبلغ سبد (تومان)" required>
                  {(props) => (
                    <MoneyInput
                      {...props}
                      value={threshold}
                      disabled={!canWrite || pending}
                      placeholder="مثلاً ۳٬۰۰۰٬۰۰۰"
                      required
                      onChange={(event) => setThreshold(event.target.value)}
                    />
                  )}
                </FormField>
                <FormField
                  id="shipping-discounted-cost"
                  label="هزینه ارسال بعد از حد نصاب (تومان)"
                  hint="برای ارسال رایگان، صفر وارد کنید."
                  required
                >
                  {(props) => (
                    <MoneyInput
                      {...props}
                      value={discountedCost}
                      disabled={!canWrite || pending}
                      placeholder="صفر یا مبلغی کمتر از هزینه ثابت"
                      required
                      onChange={(event) => setDiscountedCost(event.target.value)}
                    />
                  )}
                </FormField>
              </div>
            ) : null}
          </div>
        ) : null}

        <Button type="submit" loading={pending} disabled={!canWrite}>
          ذخیره تنظیمات ارسال
        </Button>
        {!canWrite ? (
          <p className="text-xs text-[var(--admin-color-muted)]">
            برای ویرایش این بخش به مجوز تغییر تنظیمات نیاز دارید.
          </p>
        ) : null}
      </form>
    </Card>
  );
}
