'use client';

import { useState, type FormEvent } from 'react';
import { SiteMediaField } from '@/components/site-settings/site-media-field';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/form-control';
import { FormField } from '@/components/ui/form-field';
import { Checkbox } from '@/components/ui/checkbox';
import { MoneyInput } from '@/components/ui/money-input';
import { Select } from '@/components/ui/select';
import { parseAdminMoneyInput, toPersianDigits } from '@/lib/presentation/formatters';
import {
  parseAdminShippingCarrier,
  type AdminShippingCarrier,
  type ShippingCarrierPricingMode,
  type ShippingCarrierServiceArea,
} from '@/lib/shipping/shipping-pricing-model';
import type { SiteMedia } from '@/lib/site-settings/site-settings-model';

type Props = Readonly<{
  initialCarriers: readonly AdminShippingCarrier[];
  canWrite: boolean;
}>;

function responseMessage(payload: unknown): string {
  if (typeof payload === 'object' && payload !== null && 'message' in payload) {
    const message = (payload as { message?: unknown }).message;
    if (typeof message === 'string') return message;
    if (Array.isArray(message)) return message.join('، ');
  }
  return 'ذخیره شرکت ارسال انجام نشد. دوباره تلاش کنید.';
}

function validTrackingUrl(value: string): boolean {
  return !value.trim() || value.trim().startsWith('https://');
}

function money(value: number | null): string {
  return value === null ? '' : toPersianDigits(value);
}

function pricingValues(
  mode: ShippingCarrierPricingMode,
  baseCost: string,
  thresholdEnabled: boolean,
  threshold: string,
  discountedCost: string,
) {
  return {
    pricingMode: mode,
    baseCostToman: mode === 'FIXED' ? parseAdminMoneyInput(baseCost) : 0,
    thresholdToman: mode === 'FIXED' && thresholdEnabled ? parseAdminMoneyInput(threshold) : null,
    discountedCostToman:
      mode === 'FIXED' && thresholdEnabled ? parseAdminMoneyInput(discountedCost) : null,
  };
}

function validatePricing(values: ReturnType<typeof pricingValues>): string | null {
  if (values.pricingMode === 'FIXED' && (!values.baseCostToman || values.baseCostToman <= 0))
    return 'هزینه ثابت ارسال باید بیشتر از صفر باشد.';
  if (
    values.pricingMode === 'FIXED' &&
    ((values.thresholdToman === null) !== (values.discountedCostToman === null) ||
      (values.thresholdToman !== null &&
        (values.thresholdToman <= 0 ||
          values.discountedCostToman === null ||
          values.discountedCostToman >= (values.baseCostToman ?? 0))))
  )
    return 'حد نصاب و هزینه بعد از آن را معتبر و کمتر از هزینه ثابت وارد کنید.';
  return null;
}

function CarrierPricingFields({
  prefix,
  mode,
  setMode,
  baseCost,
  setBaseCost,
  thresholdEnabled,
  setThresholdEnabled,
  threshold,
  setThreshold,
  discountedCost,
  setDiscountedCost,
  serviceArea,
  setServiceArea,
  disabled,
}: Readonly<{
  prefix: string;
  mode: ShippingCarrierPricingMode;
  setMode: (value: ShippingCarrierPricingMode) => void;
  baseCost: string;
  setBaseCost: (value: string) => void;
  thresholdEnabled: boolean;
  setThresholdEnabled: (value: boolean) => void;
  threshold: string;
  setThreshold: (value: string) => void;
  discountedCost: string;
  setDiscountedCost: (value: string) => void;
  serviceArea: ShippingCarrierServiceArea;
  setServiceArea: (value: ShippingCarrierServiceArea) => void;
  disabled: boolean;
}>) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <FormField id={`${prefix}-pricing-mode`} label="روش محاسبه هزینه" required>
        {(props) => (
          <Select
            {...props}
            value={mode}
            disabled={disabled}
            options={[
              { value: 'FREE', label: 'ارسال رایگان' },
              { value: 'FIXED', label: 'هزینه ثابت' },
              { value: 'COLLECT', label: 'پس‌کرایه پیک تهران' },
            ]}
            onValueChange={(value) => {
              const next = value as ShippingCarrierPricingMode;
              setMode(next);
              if (next === 'COLLECT') setServiceArea('TEHRAN_ONLY');
              if (next !== 'FIXED') setThresholdEnabled(false);
            }}
          />
        )}
      </FormField>
      <FormField id={`${prefix}-service-area`} label="محدوده ارسال" required>
        {(props) => (
          <Select
            {...props}
            value={serviceArea}
            disabled={disabled || mode === 'COLLECT'}
            options={[
              { value: 'NATIONWIDE', label: 'سراسر کشور' },
              { value: 'TEHRAN_ONLY', label: 'فقط شهر تهران' },
            ]}
            onValueChange={(value) => setServiceArea(value as ShippingCarrierServiceArea)}
          />
        )}
      </FormField>
      {mode === 'FIXED' ? (
        <>
          <FormField id={`${prefix}-base-cost`} label="هزینه ثابت (تومان)" required>
            {(props) => (
              <MoneyInput
                {...props}
                value={baseCost}
                disabled={disabled}
                onChange={(event) => setBaseCost(event.target.value)}
              />
            )}
          </FormField>
          <div className="flex items-end pb-2">
            <Checkbox
              id={`${prefix}-threshold-enabled`}
              checked={thresholdEnabled}
              disabled={disabled}
              label="هزینه متفاوت بعد از حد نصاب"
              onChange={(event) => setThresholdEnabled(event.target.checked)}
            />
          </div>
          {thresholdEnabled ? (
            <>
              <FormField id={`${prefix}-threshold`} label="حداقل مبلغ سبد (تومان)" required>
                {(props) => (
                  <MoneyInput
                    {...props}
                    value={threshold}
                    disabled={disabled}
                    onChange={(event) => setThreshold(event.target.value)}
                  />
                )}
              </FormField>
              <FormField
                id={`${prefix}-discounted-cost`}
                label="هزینه بعد از حد نصاب (تومان)"
                hint="برای رایگان‌شدن ارسال، صفر وارد کنید."
                required
              >
                {(props) => (
                  <MoneyInput
                    {...props}
                    value={discountedCost}
                    disabled={disabled}
                    onChange={(event) => setDiscountedCost(event.target.value)}
                  />
                )}
              </FormField>
            </>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function CarrierEditor({
  carrier,
  canWrite,
  onUpdated,
  onError,
  onSuccess,
}: Readonly<{
  carrier: AdminShippingCarrier;
  canWrite: boolean;
  onUpdated: (carrier: AdminShippingCarrier) => void;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
}>) {
  const [name, setName] = useState(carrier.name);
  const [subtitle, setSubtitle] = useState(carrier.subtitle ?? '');
  const [trackingUrl, setTrackingUrl] = useState(carrier.trackingUrl ?? '');
  const [logo, setLogo] = useState<SiteMedia | null>(carrier.logo);
  const [pricingMode, setPricingMode] = useState(carrier.pricingMode);
  const [baseCost, setBaseCost] = useState(money(carrier.baseCostToman));
  const [thresholdEnabled, setThresholdEnabled] = useState(carrier.thresholdToman !== null);
  const [threshold, setThreshold] = useState(money(carrier.thresholdToman));
  const [discountedCost, setDiscountedCost] = useState(money(carrier.discountedCostToman));
  const [serviceArea, setServiceArea] = useState(carrier.serviceArea);
  const [pending, setPending] = useState(false);

  async function update(values: Record<string, unknown>, success: string) {
    if (pending || !canWrite) return;
    setPending(true);
    onError('');
    try {
      const response = await fetch(`/api/shipping/carriers/${encodeURIComponent(carrier.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const payload = (await response.json().catch(() => null)) as unknown;
      if (!response.ok) throw new Error(responseMessage(payload));
      const updated = parseAdminShippingCarrier(payload);
      if (!updated) throw new Error('پاسخ سرویس شرکت‌های ارسال معتبر نبود.');
      setName(updated.name);
      setSubtitle(updated.subtitle ?? '');
      setTrackingUrl(updated.trackingUrl ?? '');
      setLogo(updated.logo);
      setPricingMode(updated.pricingMode);
      setBaseCost(money(updated.baseCostToman));
      setThresholdEnabled(updated.thresholdToman !== null);
      setThreshold(money(updated.thresholdToman));
      setDiscountedCost(money(updated.discountedCostToman));
      setServiceArea(updated.serviceArea);
      onUpdated(updated);
      onSuccess(success);
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : responseMessage(null));
    } finally {
      setPending(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (name.trim().length < 2) return onError('نام شرکت ارسال باید حداقل ۲ نویسه باشد.');
    if (subtitle.trim().length < 2) return onError('زیرعنوان روش ارسال باید حداقل ۲ نویسه باشد.');
    if (!validTrackingUrl(trackingUrl))
      return onError('نشانی سایت استعلام باید با https:// آغاز شود.');
    const pricing = pricingValues(
      pricingMode,
      baseCost,
      thresholdEnabled,
      threshold,
      discountedCost,
    );
    const pricingError = validatePricing(pricing);
    if (pricingError) return onError(pricingError);
    void update(
      {
        name: name.trim(),
        subtitle: subtitle.trim(),
        trackingUrl: trackingUrl.trim() || null,
        logoMediaId: logo?.id ?? null,
        ...pricing,
        serviceArea,
      },
      `اطلاعات «${name.trim()}» ذخیره شد.`,
    );
  }

  return (
    <Card>
      <form className="space-y-4" onSubmit={submit}>
        <div className="flex items-center justify-between gap-3">
          <Badge tone={carrier.isActive ? 'success' : 'neutral'}>
            {carrier.isActive ? 'فعال' : 'غیرفعال'}
          </Badge>
          <Button
            type="button"
            size="sm"
            variant="outline"
            loading={pending}
            disabled={!canWrite}
            onClick={() =>
              void update(
                { isActive: !carrier.isActive },
                carrier.isActive
                  ? `«${carrier.name}» از گزینه‌های ساخت مرسوله حذف شد.`
                  : `«${carrier.name}» به گزینه‌های ساخت مرسوله اضافه شد.`,
              )
            }
          >
            {carrier.isActive ? 'غیرفعال‌کردن' : 'فعال‌کردن'}
          </Button>
        </div>
        <FormField id={`carrier-name-${carrier.id}`} label="نام شرکت ارسال" required>
          {(props) => (
            <Input
              {...props}
              value={name}
              maxLength={200}
              disabled={!canWrite || pending}
              onChange={(event) => setName(event.target.value)}
            />
          )}
        </FormField>
        <FormField
          id={`carrier-subtitle-${carrier.id}`}
          label="زیرعنوان روش ارسال"
          hint="یک توضیح کوتاه درباره مزیت یا نحوه سرویس‌دهی این شرکت بنویسید."
          required
        >
          {(props) => (
            <Input
              {...props}
              value={subtitle}
              maxLength={240}
              placeholder="مثلاً ارسال سریع با رهگیری آنلاین"
              disabled={!canWrite || pending}
              onChange={(event) => setSubtitle(event.target.value)}
            />
          )}
        </FormField>
        <FormField
          id={`carrier-url-${carrier.id}`}
          label="نشانی سایت استعلام"
          hint="نشانی کامل و امن را با https:// وارد کنید."
        >
          {(props) => (
            <Input
              {...props}
              type="url"
              dir="ltr"
              value={trackingUrl}
              maxLength={1000}
              disabled={!canWrite || pending}
              onChange={(event) => setTrackingUrl(event.target.value)}
            />
          )}
        </FormField>
        <SiteMediaField
          label="نماد شرکت ارسال"
          media={logo}
          altText={name.trim() || 'نماد شرکت ارسال'}
          aspect="wide"
          disabled={!canWrite || pending}
          hint="ترجیحاً تصویر PNG یا WebP با پس‌زمینه شفاف بارگذاری کنید."
          onUploaded={setLogo}
          onClear={() => setLogo(null)}
        />
        <CarrierPricingFields
          prefix={`carrier-${carrier.id}`}
          mode={pricingMode}
          setMode={setPricingMode}
          baseCost={baseCost}
          setBaseCost={setBaseCost}
          thresholdEnabled={thresholdEnabled}
          setThresholdEnabled={setThresholdEnabled}
          threshold={threshold}
          setThreshold={setThreshold}
          discountedCost={discountedCost}
          setDiscountedCost={setDiscountedCost}
          serviceArea={serviceArea}
          setServiceArea={setServiceArea}
          disabled={!canWrite || pending}
        />
        <Button
          type="submit"
          loading={pending}
          disabled={!canWrite || name.trim().length < 2 || subtitle.trim().length < 2}
        >
          ذخیره شرکت
        </Button>
      </form>
    </Card>
  );
}

export function ShippingCarriersSettingsCard({ initialCarriers, canWrite }: Props) {
  const [carriers, setCarriers] = useState(initialCarriers);
  const [name, setName] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [trackingUrl, setTrackingUrl] = useState('');
  const [logo, setLogo] = useState<SiteMedia | null>(null);
  const [pricingMode, setPricingMode] = useState<ShippingCarrierPricingMode>('FREE');
  const [baseCost, setBaseCost] = useState('');
  const [thresholdEnabled, setThresholdEnabled] = useState(false);
  const [threshold, setThreshold] = useState('');
  const [discountedCost, setDiscountedCost] = useState('');
  const [serviceArea, setServiceArea] = useState<ShippingCarrierServiceArea>('NATIONWIDE');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !canWrite) return;
    if (name.trim().length < 2) return setError('نام شرکت ارسال باید حداقل ۲ نویسه باشد.');
    if (subtitle.trim().length < 2) return setError('زیرعنوان روش ارسال باید حداقل ۲ نویسه باشد.');
    if (!validTrackingUrl(trackingUrl))
      return setError('نشانی سایت استعلام باید با https:// آغاز شود.');
    const pricing = pricingValues(
      pricingMode,
      baseCost,
      thresholdEnabled,
      threshold,
      discountedCost,
    );
    const pricingError = validatePricing(pricing);
    if (pricingError) return setError(pricingError);
    setPending(true);
    setError('');
    setSuccess('');
    try {
      const response = await fetch('/api/shipping/carriers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          subtitle: subtitle.trim(),
          trackingUrl: trackingUrl.trim() || null,
          logoMediaId: logo?.id ?? null,
          ...pricing,
          serviceArea,
          isActive: true,
        }),
      });
      const payload = (await response.json().catch(() => null)) as unknown;
      if (!response.ok) throw new Error(responseMessage(payload));
      const created = parseAdminShippingCarrier(payload);
      if (!created) throw new Error('پاسخ سرویس شرکت‌های ارسال معتبر نبود.');
      setCarriers((current) => [created, ...current]);
      setName('');
      setSubtitle('');
      setTrackingUrl('');
      setLogo(null);
      setPricingMode('FREE');
      setBaseCost('');
      setThresholdEnabled(false);
      setThreshold('');
      setDiscountedCost('');
      setServiceArea('NATIONWIDE');
      setSuccess(`شرکت «${created.name}» اضافه و برای ساخت مرسوله فعال شد.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : responseMessage(null));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="space-y-4" aria-labelledby="shipping-carriers-heading">
      <div>
        <h2 id="shipping-carriers-heading" className="text-xl font-black">
          شرکت‌های ارسال
        </h2>
        <p className="mt-2 text-sm leading-7 text-[var(--admin-color-muted)]">
          شرکت‌های فعال در صفحه پرداخت و هنگام ساخت مرسوله در دسترس هستند. هزینه، محدوده ارسال و
          اطلاعات شرکت انتخاب‌شده روی سفارش ذخیره می‌شود.
        </p>
      </div>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {success ? <Alert tone="success">{success}</Alert> : null}
      {canWrite ? (
        <Card title="افزودن شرکت ارسال" description="اطلاعات شرکت جدید را ثبت کنید.">
          <form className="grid gap-4 lg:grid-cols-2" onSubmit={create}>
            <FormField id="new-carrier-name" label="نام شرکت ارسال" required>
              {(props) => (
                <Input
                  {...props}
                  value={name}
                  maxLength={200}
                  placeholder="مثلاً ماهکس"
                  disabled={pending}
                  onChange={(event) => setName(event.target.value)}
                />
              )}
            </FormField>
            <FormField
              id="new-carrier-subtitle"
              label="زیرعنوان روش ارسال"
              hint="یک توضیح کوتاه درباره مزیت یا نحوه سرویس‌دهی این شرکت بنویسید."
              required
            >
              {(props) => (
                <Input
                  {...props}
                  value={subtitle}
                  maxLength={240}
                  placeholder="مثلاً ارسال سریع با رهگیری آنلاین"
                  disabled={pending}
                  onChange={(event) => setSubtitle(event.target.value)}
                />
              )}
            </FormField>
            <FormField
              id="new-carrier-url"
              label="نشانی سایت استعلام"
              hint="نشانی کامل و امن را با https:// وارد کنید."
            >
              {(props) => (
                <Input
                  {...props}
                  type="url"
                  dir="ltr"
                  value={trackingUrl}
                  maxLength={1000}
                  placeholder="https://example.com/tracking"
                  disabled={pending}
                  onChange={(event) => setTrackingUrl(event.target.value)}
                />
              )}
            </FormField>
            <SiteMediaField
              label="نماد شرکت ارسال"
              media={logo}
              altText={name.trim() || 'نماد شرکت ارسال'}
              aspect="wide"
              disabled={pending}
              hint="ترجیحاً تصویر PNG یا WebP با پس‌زمینه شفاف بارگذاری کنید."
              onUploaded={setLogo}
              onClear={() => setLogo(null)}
            />
            <div className="lg:col-span-2">
              <CarrierPricingFields
                prefix="new-carrier"
                mode={pricingMode}
                setMode={setPricingMode}
                baseCost={baseCost}
                setBaseCost={setBaseCost}
                thresholdEnabled={thresholdEnabled}
                setThresholdEnabled={setThresholdEnabled}
                threshold={threshold}
                setThreshold={setThreshold}
                discountedCost={discountedCost}
                setDiscountedCost={setDiscountedCost}
                serviceArea={serviceArea}
                setServiceArea={setServiceArea}
                disabled={pending}
              />
            </div>
            <div className="flex items-end">
              <Button
                type="submit"
                loading={pending}
                disabled={name.trim().length < 2 || subtitle.trim().length < 2}
              >
                افزودن شرکت
              </Button>
            </div>
          </form>
        </Card>
      ) : null}
      {carriers.length ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {carriers.map((carrier) => (
            <CarrierEditor
              key={carrier.id}
              carrier={carrier}
              canWrite={canWrite}
              onError={setError}
              onSuccess={setSuccess}
              onUpdated={(updated) =>
                setCarriers((current) =>
                  current.map((item) => (item.id === updated.id ? updated : item)),
                )
              }
            />
          ))}
        </div>
      ) : (
        <Alert tone="neutral">هنوز شرکت ارسالی ثبت نشده است.</Alert>
      )}
    </section>
  );
}
