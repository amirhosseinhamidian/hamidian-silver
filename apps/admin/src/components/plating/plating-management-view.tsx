'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, type InputEvent, useId, useMemo, useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { BottomSheet, BottomSheetContent, BottomSheetTrigger } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import type { DataTableColumn } from '@/components/ui/data-table';
import { FilterBar, SearchField } from '@/components/ui/filter-bar';
import { Input, Textarea } from '@/components/ui/form-control';
import { FormField } from '@/components/ui/form-field';
import { MobileDataCard } from '@/components/ui/mobile-data-card';
import { ResponsiveDataView } from '@/components/ui/responsive-data-view';
import { Select } from '@/components/ui/select';
import {
  type AdminPlatingRate,
  type AdminPlatingType,
  type AdminPlatingVariant,
  platingTypeLabel,
} from '@/lib/plating/plating-model';
import {
  formatAdminDateTime,
  formatAdminInteger,
  formatAdminToman,
  toAsciiDigits,
  toPersianDigits,
} from '@/lib/presentation/formatters';

const PLATING_TYPES: readonly AdminPlatingType[] = ['GOLD', 'RHODIUM'];

type PlatingManagementViewProps = Readonly<{
  rates: readonly AdminPlatingRate[];
  variants: readonly AdminPlatingVariant[];
  ratesFailed: boolean;
  variantsFailed: boolean;
  canWritePricing: boolean;
  canWriteCatalog: boolean;
}>;

function apiError(payload: unknown): string {
  const translations: Record<string, string> = {
    'Product variant was not found.': 'تنوع محصول پیدا نشد یا غیرفعال است.',
    'Plating must be enabled for this variant first.': 'ابتدا قابلیت آبکاری این تنوع را فعال کنید.',
    'Plating rate was not found.': 'نرخ آبکاری پیدا نشد.',
    'The selected plating rate is inactive.': 'نرخ آبکاری انتخاب‌شده غیرفعال است.',
  };
  if (typeof payload === 'object' && payload !== null) {
    const value = payload as Record<string, unknown>;
    if (typeof value.message === 'string') return translations[value.message] ?? value.message;
    if (Array.isArray(value.message)) return value.message.join('، ');
    const nested = value.error as Record<string, unknown> | undefined;
    if (typeof nested?.message === 'string') return translations[nested.message] ?? nested.message;
  }
  return 'عملیات آبکاری انجام نشد. دوباره تلاش کنید.';
}

function localizedNumber(value: FormDataEntryValue | null): number | null {
  const normalized = toAsciiDigits(String(value ?? ''))
    .replace(/[٬,\s]/g, '')
    .replace('٫', '.');
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function localizeNumberInput(event: InputEvent<HTMLInputElement>) {
  event.currentTarget.value = toPersianDigits(toAsciiDigits(event.currentTarget.value));
}

async function requestJson(path: string, method: 'PATCH' | 'PUT', body: unknown) {
  const response = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) throw new Error(apiError(payload));
  return payload;
}

function optionFor(variant: AdminPlatingVariant, type: AdminPlatingType) {
  return variant.options.find((option) => option.type === type);
}

function formatWeight(weight: number | null): string {
  if (weight === null) return 'ثبت نشده';
  return `${toPersianDigits(weight.toLocaleString('en-US', { maximumFractionDigits: 3 }))} گرم`;
}

function variantStatus(variant: AdminPlatingVariant) {
  if (!variant.active) return <Badge tone="neutral">تنوع غیرفعال</Badge>;
  return (
    <Badge tone={variant.eligible ? 'success' : 'neutral'} dot>
      {variant.eligible ? 'آبکاری فعال' : 'بدون آبکاری'}
    </Badge>
  );
}

type RateFormProps = Readonly<{
  formId: string;
  type: AdminPlatingType;
  rate?: AdminPlatingRate;
  onSaved: () => void;
  onPendingChange: (pending: boolean) => void;
}>;

function RateForm({ formId, type, rate, onSaved, onPendingChange }: RateFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const price = localizedNumber(formData.get('pricePerGramToman'));
    const leadTime = localizedNumber(formData.get('leadTimeDays'));
    const reason = String(formData.get('reason') ?? '').trim();
    if (price === null || !Number.isInteger(price) || price < 0) {
      return setError('نرخ هر گرم باید یک عدد صحیح صفر یا بزرگ‌تر باشد.');
    }
    if (leadTime === null || !Number.isInteger(leadTime) || leadTime < 0 || leadTime > 365) {
      return setError('زمان آماده‌سازی باید عددی بین صفر تا ۳۶۵ روز باشد.');
    }
    if (!reason) return setError('دلیل تغییر نرخ برای ثبت در تاریخچه الزامی است.');

    setError(null);
    onPendingChange(true);
    try {
      await requestJson(`/api/plating/rates/${type}`, 'PUT', {
        pricePerGramToman: price,
        leadTimeDays: leadTime,
        isActive: formData.get('isActive') === 'on',
        reason,
      });
      onSaved();
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : apiError(null));
    } finally {
      onPendingChange(false);
    }
  }

  return (
    <form id={formId} onSubmit={(event) => void submit(event)} className="space-y-4">
      {error ? (
        <Alert tone="danger" title="ثبت نرخ ناموفق بود">
          {error}
        </Alert>
      ) : null}
      {rate ? (
        <Alert tone="info">آخرین تغییر: {formatAdminDateTime(rate.updatedAt)}</Alert>
      ) : (
        <Alert tone="warning">برای این نوع آبکاری هنوز نرخی ثبت نشده است.</Alert>
      )}
      <FormField id={`${formId}-price`} label="نرخ هر گرم" hint="مبلغ به تومان" required>
        {(props) => (
          <Input
            {...props}
            name="pricePerGramToman"
            defaultValue={toPersianDigits(rate?.pricePerGramToman ?? 0)}
            placeholder="مثلاً ۵۰٬۰۰۰"
            inputMode="numeric"
            onInput={localizeNumberInput}
            required
          />
        )}
      </FormField>
      <FormField id={`${formId}-lead`} label="زمان آماده‌سازی" hint="تعداد روز" required>
        {(props) => (
          <Input
            {...props}
            name="leadTimeDays"
            defaultValue={toPersianDigits(rate?.leadTimeDays ?? 0)}
            placeholder="مثلاً ۳"
            inputMode="numeric"
            onInput={localizeNumberInput}
            required
          />
        )}
      </FormField>
      <FormField id={`${formId}-reason`} label="دلیل تغییر" required>
        {(props) => (
          <Textarea
            {...props}
            name="reason"
            placeholder="مثلاً بروزرسانی نرخ تأمین‌کننده"
            maxLength={500}
            required
          />
        )}
      </FormField>
      <Checkbox
        id={`${formId}-active`}
        name="isActive"
        label="این نرخ فعال باشد"
        description="نرخ غیرفعال برای سفارش جدید قابل انتخاب نیست."
        defaultChecked={rate?.active ?? true}
      />
    </form>
  );
}

function RateSheet({ type, rate }: Readonly<{ type: AdminPlatingType; rate?: AdminPlatingRate }>) {
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  return (
    <BottomSheet open={open} onOpenChange={setOpen}>
      <BottomSheetTrigger asChild>
        <Button size="sm" variant="outline">
          {rate ? 'ویرایش نرخ' : 'ثبت نرخ'}
        </Button>
      </BottomSheetTrigger>
      <BottomSheetContent
        title={platingTypeLabel(type)}
        description="نرخ، زمان آماده‌سازی و وضعیت فروش را مدیریت کنید."
        footer={
          <>
            <Button variant="outline" disabled={pending} onClick={() => setOpen(false)}>
              انصراف
            </Button>
            <Button type="submit" form={formId} loading={pending}>
              ذخیره نرخ
            </Button>
          </>
        }
      >
        <RateForm
          formId={formId}
          type={type}
          rate={rate}
          onSaved={() => setOpen(false)}
          onPendingChange={setPending}
        />
      </BottomSheetContent>
    </BottomSheet>
  );
}

function RateCard({
  type,
  rate,
  canWrite,
}: Readonly<{ type: AdminPlatingType; rate?: AdminPlatingRate; canWrite: boolean }>) {
  return (
    <Card
      title={platingTypeLabel(type)}
      description={type === 'GOLD' ? 'پوشش طلایی محصولات نقره' : 'پوشش رودیوم با ظاهر روشن'}
      action={canWrite ? <RateSheet type={type} rate={rate} /> : null}
      className={type === 'GOLD' ? 'border-amber-200' : undefined}
    >
      {rate ? (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-[var(--admin-color-muted)]">نرخ هر گرم</p>
            <p className="mt-1 text-lg font-black">{formatAdminToman(rate.pricePerGramToman)}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--admin-color-muted)]">زمان آماده‌سازی</p>
            <p className="mt-1 text-lg font-black">{formatAdminInteger(rate.leadTimeDays)} روز</p>
          </div>
          <div className="col-span-2 mt-1">
            {rate.active ? (
              <Badge tone="success" dot>
                فعال
              </Badge>
            ) : (
              <Badge tone="neutral" dot>
                غیرفعال
              </Badge>
            )}
          </div>
        </div>
      ) : (
        <p className="text-sm text-[var(--admin-color-muted)]">نرخ ثبت نشده است.</p>
      )}
    </Card>
  );
}

type VariantFormProps = Readonly<{
  formId: string;
  variant: AdminPlatingVariant;
  rates: readonly AdminPlatingRate[];
  canWritePricing: boolean;
  canWriteCatalog: boolean;
  onSaved: () => void;
  onPendingChange: (pending: boolean) => void;
}>;

function VariantForm({
  formId,
  variant,
  rates,
  canWritePricing,
  canWriteCatalog,
  onSaved,
  onPendingChange,
}: VariantFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [eligible, setEligible] = useState(variant.eligible);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const weight = localizedNumber(formData.get('weightGrams'));
    const wantsEligibility = formData.get('eligible') === 'on';
    if (weight !== null && (weight <= 0 || weight > 9999999)) {
      return setError('وزن باید یک عدد مثبت با حداکثر سه رقم اعشار باشد.');
    }
    if (wantsEligibility && weight === null) {
      return setError('برای فعال‌سازی آبکاری، ثبت وزن تنوع الزامی است.');
    }
    if (!canWriteCatalog && weight !== variant.weightGrams) {
      return setError('برای تغییر وزن به دسترسی ویرایش کاتالوگ نیاز دارید.');
    }

    setError(null);
    onPendingChange(true);
    let savedAny = false;
    try {
      if (canWriteCatalog && weight !== variant.weightGrams) {
        await requestJson(
          `/api/catalog/products/${variant.productId}/variants/${variant.id}`,
          'PATCH',
          { weightGrams: weight },
        );
        savedAny = true;
      }
      if (canWritePricing && wantsEligibility !== variant.eligible) {
        await requestJson(`/api/plating/variants/${variant.id}/eligibility`, 'PATCH', {
          platingEligible: wantsEligibility,
        });
        savedAny = true;
      }
      if (canWritePricing && wantsEligibility) {
        for (const type of PLATING_TYPES) {
          const desired = formData.get(`option-${type}`) === 'on';
          const current = optionFor(variant, type)?.active ?? false;
          if (desired !== current) {
            await requestJson(`/api/plating/variants/${variant.id}/options/${type}`, 'PUT', {
              isActive: desired,
            });
            savedAny = true;
          }
        }
      }
      if (!savedAny) {
        onSaved();
        return;
      }
      onSaved();
      router.refresh();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : apiError(null);
      setError(savedAny ? `بخشی از تغییرات ذخیره شد؛ صفحه را تازه‌سازی کنید. ${message}` : message);
      if (savedAny) router.refresh();
    } finally {
      onPendingChange(false);
    }
  }

  return (
    <form id={formId} onSubmit={(event) => void submit(event)} className="space-y-4">
      {error ? (
        <Alert tone="danger" title="ذخیره تنظیمات ناموفق بود">
          {error}
        </Alert>
      ) : null}
      {!variant.active ? (
        <Alert tone="warning">
          این تنوع غیرفعال است؛ برای تغییر آبکاری ابتدا آن را در صفحه محصول فعال کنید.
        </Alert>
      ) : null}
      <dl className="grid grid-cols-2 gap-2 rounded-[var(--admin-radius-md)] bg-[var(--admin-color-surface-subtle)] p-3 text-sm">
        <div>
          <dt className="text-xs text-[var(--admin-color-muted)]">محصول</dt>
          <dd className="mt-1 font-bold">{variant.productName}</dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--admin-color-muted)]">SKU</dt>
          <dd dir="ltr" className="mt-1 text-right font-bold">
            {toPersianDigits(variant.sku)}
          </dd>
        </div>
      </dl>
      <FormField
        id={`${formId}-weight`}
        label="وزن مبنای آبکاری"
        hint="گرم، حداکثر سه رقم اعشار"
        required={eligible}
      >
        {(props) => (
          <Input
            {...props}
            name="weightGrams"
            defaultValue={variant.weightGrams === null ? '' : toPersianDigits(variant.weightGrams)}
            placeholder="مثلاً ۴٫۲۵۰"
            inputMode="decimal"
            onInput={localizeNumberInput}
            disabled={!canWriteCatalog || !variant.active}
          />
        )}
      </FormField>
      <Checkbox
        id={`${formId}-eligible`}
        name="eligible"
        label="این تنوع قابلیت آبکاری داشته باشد"
        description="با غیرفعال‌کردن این گزینه، همه گزینه‌های آبکاری تنوع نیز غیرفعال می‌شوند."
        checked={eligible}
        onChange={(event) => setEligible(event.target.checked)}
        disabled={!canWritePricing || !variant.active}
      />
      <section className="space-y-3 rounded-[var(--admin-radius-md)] border border-[var(--admin-color-border)] p-3">
        <h3 className="text-sm font-bold">گزینه‌های قابل سفارش</h3>
        {PLATING_TYPES.map((type) => {
          const rate = rates.find((item) => item.type === type);
          const option = optionFor(variant, type);
          const unavailable = !rate?.active;
          return (
            <Checkbox
              key={type}
              id={`${formId}-${type}`}
              name={`option-${type}`}
              label={platingTypeLabel(type)}
              description={
                rate
                  ? `${formatAdminToman(rate.pricePerGramToman)} برای هر گرم · ${formatAdminInteger(rate.leadTimeDays)} روز`
                  : 'نرخ این گزینه ثبت نشده است.'
              }
              defaultChecked={option?.active ?? false}
              disabled={!canWritePricing || !eligible || unavailable || !variant.active}
            />
          );
        })}
      </section>
      {!canWritePricing && !canWriteCatalog ? (
        <Alert tone="info">حساب شما فقط امکان مشاهده تنظیمات آبکاری را دارد.</Alert>
      ) : null}
    </form>
  );
}

function VariantSheet({
  variant,
  rates,
  canWritePricing,
  canWriteCatalog,
  triggerLabel = 'تنظیم آبکاری',
}: Readonly<{
  variant: AdminPlatingVariant;
  rates: readonly AdminPlatingRate[];
  canWritePricing: boolean;
  canWriteCatalog: boolean;
  triggerLabel?: string;
}>) {
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const canWrite = canWritePricing || canWriteCatalog;
  return (
    <BottomSheet open={open} onOpenChange={setOpen}>
      <BottomSheetTrigger asChild>
        <Button size="sm" variant="outline">
          {canWrite ? triggerLabel : 'مشاهده جزئیات'}
        </Button>
      </BottomSheetTrigger>
      <BottomSheetContent
        title={variant.name ?? variant.sizeLabel ?? toPersianDigits(variant.sku)}
        description="وزن، قابلیت آبکاری و گزینه‌های قابل سفارش را مدیریت کنید."
        height="large"
        footer={
          canWrite ? (
            <>
              <Button variant="outline" disabled={pending} onClick={() => setOpen(false)}>
                انصراف
              </Button>
              <Button type="submit" form={formId} loading={pending} disabled={!variant.active}>
                ذخیره تغییرات
              </Button>
            </>
          ) : undefined
        }
      >
        <VariantForm
          formId={formId}
          variant={variant}
          rates={rates}
          canWritePricing={canWritePricing}
          canWriteCatalog={canWriteCatalog}
          onSaved={() => setOpen(false)}
          onPendingChange={setPending}
        />
      </BottomSheetContent>
    </BottomSheet>
  );
}

function optionBadges(variant: AdminPlatingVariant) {
  const active = variant.options.filter((option) => option.active && option.rateActive);
  if (!active.length)
    return <span className="text-xs text-[var(--admin-color-subtle)]">بدون گزینه</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {active.map((option) => (
        <Badge key={option.type} tone={option.type === 'GOLD' ? 'warning' : 'info'}>
          {option.type === 'GOLD' ? 'طلا' : 'رودیوم'}
        </Badge>
      ))}
    </div>
  );
}

function VariantMobileCard({
  variant,
  rates,
  canWritePricing,
  canWriteCatalog,
}: Readonly<{
  variant: AdminPlatingVariant;
  rates: readonly AdminPlatingRate[];
  canWritePricing: boolean;
  canWriteCatalog: boolean;
}>) {
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const canWrite = canWritePricing || canWriteCatalog;
  return (
    <MobileDataCard
      eyebrow={toPersianDigits(variant.sku)}
      title={variant.productName}
      status={variantStatus(variant)}
      items={[
        { label: 'وزن', value: formatWeight(variant.weightGrams) },
        {
          label: 'گزینه‌ها',
          value: `${formatAdminInteger(variant.options.filter((option) => option.active && option.rateActive).length)} فعال`,
        },
      ]}
      detailsTitle={variant.productName}
      detailsDescription="جزئیات کامل و تنظیم سریع آبکاری"
      detailsOpen={open}
      onDetailsOpenChange={setOpen}
      details={
        <VariantForm
          formId={formId}
          variant={variant}
          rates={rates}
          canWritePricing={canWritePricing}
          canWriteCatalog={canWriteCatalog}
          onSaved={() => setOpen(false)}
          onPendingChange={setPending}
        />
      }
      detailsFooter={
        canWrite ? (
          <Button type="submit" form={formId} loading={pending} disabled={!variant.active}>
            ذخیره تغییرات
          </Button>
        ) : undefined
      }
    />
  );
}

export function PlatingManagementView({
  rates,
  variants,
  ratesFailed,
  variantsFailed,
  canWritePricing,
  canWriteCatalog,
}: PlatingManagementViewProps) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const normalizedQuery = query.trim().toLocaleLowerCase('fa');
  const filtered = useMemo(
    () =>
      variants.filter((variant) => {
        const matchesQuery =
          !normalizedQuery ||
          variant.productName.toLocaleLowerCase('fa').includes(normalizedQuery) ||
          variant.sku.toLocaleLowerCase('en').includes(normalizedQuery) ||
          (variant.name?.toLocaleLowerCase('fa').includes(normalizedQuery) ?? false);
        const matchesFilter =
          filter === 'all' ||
          (filter === 'eligible' && variant.eligible) ||
          (filter === 'disabled' && !variant.eligible) ||
          (filter === 'missing-weight' && variant.eligible && variant.weightGrams === null);
        return matchesQuery && matchesFilter;
      }),
    [filter, normalizedQuery, variants],
  );
  const columns: readonly DataTableColumn<AdminPlatingVariant>[] = [
    {
      id: 'product',
      header: 'محصول و تنوع',
      cell: (variant) => (
        <div>
          <p className="font-bold">{variant.productName}</p>
          <p dir="ltr" className="mt-1 text-right text-xs text-[var(--admin-color-muted)]">
            {toPersianDigits(variant.sku)}
            {variant.sizeLabel ? ` · ${variant.sizeLabel}` : ''}
          </p>
        </div>
      ),
    },
    {
      id: 'weight',
      header: 'وزن',
      cell: (variant) => (
        <span
          className={
            variant.eligible && variant.weightGrams === null
              ? 'font-bold text-[var(--admin-color-danger)]'
              : ''
          }
        >
          {formatWeight(variant.weightGrams)}
        </span>
      ),
    },
    { id: 'options', header: 'گزینه‌ها', cell: optionBadges },
    { id: 'status', header: 'وضعیت', cell: variantStatus },
    {
      id: 'actions',
      header: 'عملیات',
      align: 'end',
      cell: (variant) => (
        <VariantSheet
          variant={variant}
          rates={rates}
          canWritePricing={canWritePricing}
          canWriteCatalog={canWriteCatalog}
        />
      ),
    },
  ];
  const configuredOptions = variants.reduce(
    (total, variant) =>
      total + variant.options.filter((option) => option.active && option.rateActive).length,
    0,
  );
  const missingWeights = variants.filter(
    (variant) => variant.eligible && variant.weightGrams === null,
  ).length;
  return (
    <div className="mt-6 space-y-6">
      {ratesFailed ? (
        <Alert tone="danger" title="دریافت نرخ‌ها ناموفق بود">
          تا زمان بازیابی نرخ‌ها، گزینه جدیدی را فعال نکنید.
        </Alert>
      ) : null}
      <section aria-label="نرخ‌های آبکاری" className="grid gap-3 lg:grid-cols-2">
        {PLATING_TYPES.map((type) => (
          <RateCard
            key={type}
            type={type}
            rate={rates.find((rate) => rate.type === type)}
            canWrite={canWritePricing}
          />
        ))}
      </section>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ['تنوع‌های آبکاری‌پذیر', variants.filter((variant) => variant.eligible).length],
          ['گزینه‌های فعال', configuredOptions],
          ['وزن ناقص', missingWeights],
          ['نرخ‌های فعال', rates.filter((rate) => rate.active).length],
        ].map(([label, value]) => (
          <Card key={String(label)} className="p-0">
            <p className="text-xs text-[var(--admin-color-muted)]">{label}</p>
            <p className="mt-2 text-2xl font-black">{formatAdminInteger(Number(value))}</p>
          </Card>
        ))}
      </div>
      <Card
        title="آبکاری تنوع‌های محصول"
        description="وزن مبنا و گزینه‌های طلا یا رودیوم را برای هر SKU کنترل کنید."
      >
        {missingWeights > 0 ? (
          <Alert tone="warning" className="mb-4">
            {formatAdminInteger(missingWeights)} تنوع آبکاری‌پذیر وزن ندارد و قیمت آن قابل محاسبه
            نیست.
          </Alert>
        ) : null}
        <FilterBar
          activeCount={(normalizedQuery ? 1 : 0) + (filter === 'all' ? 0 : 1)}
          resetAction={
            normalizedQuery || filter !== 'all' ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setQuery('');
                  setFilter('all');
                }}
              >
                پاک‌کردن فیلترها
              </Button>
            ) : undefined
          }
        >
          <SearchField
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="جستجو در محصول، نام تنوع یا SKU"
            aria-label="جستجوی تنظیمات آبکاری"
          />
          <Select
            value={filter}
            onValueChange={setFilter}
            aria-label="فیلتر آبکاری"
            options={[
              { value: 'all', label: 'همه تنوع‌ها' },
              { value: 'eligible', label: 'آبکاری فعال' },
              { value: 'disabled', label: 'بدون آبکاری' },
              { value: 'missing-weight', label: 'وزن ناقص' },
            ]}
          />
        </FilterBar>
        <div className="mt-4">
          <ResponsiveDataView
            mobileLabel="کارت‌های تنظیمات آبکاری"
            renderMobileCard={(variant) => (
              <VariantMobileCard
                variant={variant}
                rates={rates}
                canWritePricing={canWritePricing}
                canWriteCatalog={canWriteCatalog}
              />
            )}
            caption="جدول تنظیمات آبکاری محصولات"
            columns={columns}
            rows={filtered}
            getRowKey={(variant) => variant.id}
            error={
              variantsFailed
                ? { description: 'دریافت تنوع‌های محصولات از سرور ناموفق بود.' }
                : undefined
            }
            emptyTitle="تنوعی پیدا نشد"
            emptyDescription="فیلترها را تغییر دهید یا در صفحه محصول تنوع جدیدی بسازید."
            compact
          />
        </div>
      </Card>
    </div>
  );
}
