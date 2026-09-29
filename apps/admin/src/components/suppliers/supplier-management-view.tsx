'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useId, useMemo, useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { BottomSheet, BottomSheetContent, BottomSheetTrigger } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import type { DataTableColumn } from '@/components/ui/data-table';
import { FilterBar, SearchField } from '@/components/ui/filter-bar';
import { Input } from '@/components/ui/form-control';
import { FormField } from '@/components/ui/form-field';
import { MoneyInput } from '@/components/ui/money-input';
import { MobileDataCard } from '@/components/ui/mobile-data-card';
import { ResponsiveDataView } from '@/components/ui/responsive-data-view';
import { Select } from '@/components/ui/select';
import {
  preferredSupplier,
  type AdminSupplier,
  type AdminSupplierCrawlerType,
  type AdminSupplierProduct,
  type AdminSupplierSource,
} from '@/lib/suppliers/suppliers-model';
import {
  formatAdminDateTime,
  formatAdminInteger,
  formatAdminPhone,
  formatAdminToman,
  toAsciiDigits,
  toPersianDigits,
} from '@/lib/presentation/formatters';

type SupplierManagementViewProps = Readonly<{
  suppliers: readonly AdminSupplier[];
  products: readonly AdminSupplierProduct[];
  failed: boolean;
  canWrite: boolean;
}>;

function apiError(payload: unknown): string {
  const translations: Record<string, string> = {
    'Another supplier already uses this code.': 'این کد قبلاً برای تأمین‌کننده دیگری ثبت شده است.',
    'Supplier was not found.': 'تأمین‌کننده پیدا نشد یا دیگر در دسترس نیست.',
    'Product was not found.': 'محصول پیدا نشد یا دیگر در دسترس نیست.',
    'Supplier fields cannot be blank.': 'فیلدهای مشخصات تأمین‌کننده نمی‌توانند خالی باشند.',
    'Supplier source was not found.': 'وب‌سایت تأمین‌کننده پیدا نشد یا دیگر در دسترس نیست.',
    'Supplier source name is required.': 'نام وب‌سایت تأمین‌کننده الزامی است.',
    'This supplier already has a source for the same hostname.':
      'این دامنه قبلاً برای همین تأمین‌کننده ثبت شده است.',
    'Custom crawler sources require an adapter key.': 'کلید آداپتر اختصاصی الزامی است.',
    'Supplier source URL is invalid.': 'نشانی سایت معتبر نیست.',
    'Supplier source must use a public HTTP or HTTPS hostname.':
      'نشانی سایت باید یک دامنه عمومی معتبر با HTTP یا HTTPS باشد.',
  };
  if (typeof payload === 'object' && payload !== null) {
    const value = payload as Record<string, unknown>;
    if (typeof value.message === 'string') return translations[value.message] ?? value.message;
    if (Array.isArray(value.message)) return value.message.join('، ');
    const nested = value.error as Record<string, unknown> | undefined;
    if (typeof nested?.message === 'string') return translations[nested.message] ?? nested.message;
  }
  return 'عملیات تأمین‌کننده انجام نشد. دوباره تلاش کنید.';
}

async function requestJson(path: string, method: 'POST' | 'PATCH' | 'PUT', body: unknown) {
  const response = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) throw new Error(apiError(payload));
  return payload;
}

function normalizeNumericInput(value: string, decimal = false): string {
  const ascii = toAsciiDigits(value)
    .replace(/[٬,\s]/g, '')
    .replace('٫', '.');
  const cleaned = decimal ? ascii.replace(/[^\d.]/g, '') : ascii.replace(/\D/g, '');
  const [whole = '', ...fractionParts] = cleaned.split('.');
  const normalized = decimal
    ? `${whole}${fractionParts.length ? `.${fractionParts.join('').slice(0, 3)}` : ''}`
    : cleaned;
  return toPersianDigits(normalized).replace('.', '٫');
}

function parseNumber(value: string): number | null {
  const normalized = toAsciiDigits(value)
    .replace(/[٬,\s]/g, '')
    .replace('٫', '.');
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function supplierStatus(supplier: AdminSupplier) {
  return (
    <Badge tone={supplier.active ? 'success' : 'neutral'} dot>
      {supplier.active ? 'فعال' : 'غیرفعال'}
    </Badge>
  );
}

function productStatus(status: AdminSupplierProduct['status']) {
  if (status === 'ACTIVE') return <Badge tone="success">منتشرشده</Badge>;
  if (status === 'DRAFT') return <Badge tone="warning">پیش‌نویس</Badge>;
  return <Badge tone="neutral">آرشیوشده</Badge>;
}

const crawlerTypeOptions: ReadonlyArray<{
  value: AdminSupplierCrawlerType;
  label: string;
}> = [
  { value: 'GENERIC_HTML', label: 'HTML عمومی' },
  { value: 'JSON_LD', label: 'داده ساختاریافته JSON-LD' },
  { value: 'CUSTOM_ADAPTER', label: 'آداپتر اختصاصی' },
  { value: 'API', label: 'وب‌سرویس API' },
  { value: 'CSV', label: 'فایل CSV' },
  { value: 'XML', label: 'فایل XML' },
];

function crawlerTypeLabel(value: AdminSupplierCrawlerType): string {
  return crawlerTypeOptions.find((option) => option.value === value)?.label ?? value;
}

function crawlRunStatus(source: AdminSupplierSource) {
  const status = source.lastRun?.status;
  if (!status) return <Badge tone="neutral">هنوز اجرا نشده</Badge>;
  if (status === 'SUCCEEDED') return <Badge tone="success">موفق</Badge>;
  if (status === 'FAILED' || status === 'CANCELLED') return <Badge tone="danger">ناموفق</Badge>;
  if (status === 'PARTIAL') return <Badge tone="warning">ناتمام</Badge>;
  return <Badge tone="info">{status === 'RUNNING' ? 'در حال اجرا' : 'در صف'}</Badge>;
}

function SupplierForm({
  formId,
  supplier,
  onSaved,
  onPendingChange,
}: Readonly<{
  formId: string;
  supplier?: AdminSupplier;
  onSaved: () => void;
  onPendingChange: (pending: boolean) => void;
}>) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const code = toAsciiDigits(String(formData.get('code') ?? ''))
      .trim()
      .toUpperCase();
    const name = String(formData.get('name') ?? '').trim();
    const contactName = String(formData.get('contactName') ?? '').trim();
    const phone = toAsciiDigits(String(formData.get('phone') ?? '')).replace(/[\s-]/g, '');
    if (!code || !name) return setError('نام و کد تأمین‌کننده الزامی است.');
    if (phone && !/^\+?\d{5,20}$/.test(phone)) return setError('شماره تماس معتبر نیست.');
    setError(null);
    onPendingChange(true);
    try {
      await requestJson(
        supplier ? `/api/pricing/suppliers/${supplier.id}` : '/api/pricing/suppliers',
        supplier ? 'PATCH' : 'POST',
        {
          code,
          name,
          contactName: contactName || (supplier ? null : undefined),
          phone: phone || (supplier ? null : undefined),
          isActive: formData.get('isActive') === 'on',
        },
      );
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
        <Alert tone="danger" title="ذخیره تأمین‌کننده ناموفق بود">
          {error}
        </Alert>
      ) : null}
      {supplier?.active ? null : supplier ? (
        <Alert tone="warning">تأمین‌کننده غیرفعال برای قیمت‌گذاری جدید قابل انتخاب نیست.</Alert>
      ) : null}
      <FormField id={`${formId}-name`} label="نام تأمین‌کننده" required>
        {(props) => (
          <Input
            {...props}
            name="name"
            defaultValue={supplier?.name}
            placeholder="مثلاً نقره‌سازی پارس"
            required
          />
        )}
      </FormField>
      <FormField id={`${formId}-code`} label="کد تأمین‌کننده" hint="شناسه کوتاه و یکتا" required>
        {(props) => (
          <Input
            {...props}
            name="code"
            defaultValue={supplier ? toPersianDigits(supplier.code) : ''}
            placeholder="مثلاً SUP-01"
            dir="ltr"
            maxLength={64}
            required
          />
        )}
      </FormField>
      <FormField id={`${formId}-contact`} label="نام مسئول ارتباط">
        {(props) => (
          <Input
            {...props}
            name="contactName"
            defaultValue={supplier?.contactName ?? ''}
            placeholder="نام و نام خانوادگی"
          />
        )}
      </FormField>
      <FormField id={`${formId}-phone`} label="شماره تماس">
        {(props) => (
          <Input
            {...props}
            name="phone"
            defaultValue={supplier?.phone ? toPersianDigits(supplier.phone) : ''}
            placeholder="مثلاً ۰۹۱۲۱۲۳۴۵۶۷"
            inputMode="tel"
            dir="ltr"
            onChange={(event) => {
              event.currentTarget.value = toPersianDigits(toAsciiDigits(event.currentTarget.value));
            }}
          />
        )}
      </FormField>
      <Checkbox
        id={`${formId}-active`}
        name="isActive"
        label="تأمین‌کننده فعال باشد"
        description="با غیرفعال‌سازی، اتصال‌های فعال و وضعیت منتخب محصولات نیز غیرفعال می‌شوند."
        defaultChecked={supplier?.active ?? true}
      />
    </form>
  );
}

function SupplierSheet({
  supplier,
  triggerLabel,
}: Readonly<{ supplier?: AdminSupplier; triggerLabel: string }>) {
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  return (
    <BottomSheet open={open} onOpenChange={setOpen}>
      <BottomSheetTrigger asChild>
        <Button variant={supplier ? 'outline' : 'primary'} size="sm">
          {triggerLabel}
        </Button>
      </BottomSheetTrigger>
      <BottomSheetContent
        title={supplier ? `ویرایش ${supplier.name}` : 'افزودن تأمین‌کننده'}
        description="مشخصات ارتباطی و وضعیت همکاری را ثبت کنید."
        footer={
          <>
            <Button variant="outline" disabled={pending} onClick={() => setOpen(false)}>
              انصراف
            </Button>
            <Button type="submit" form={formId} loading={pending}>
              ذخیره تأمین‌کننده
            </Button>
          </>
        }
      >
        <SupplierForm
          formId={formId}
          supplier={supplier}
          onSaved={() => setOpen(false)}
          onPendingChange={setPending}
        />
      </BottomSheetContent>
    </BottomSheet>
  );
}

function SupplierSourceForm({
  formId,
  supplier,
  source,
  onSaved,
  onPendingChange,
}: Readonly<{
  formId: string;
  supplier: AdminSupplier;
  source?: AdminSupplierSource;
  onSaved: () => void;
  onPendingChange: (pending: boolean) => void;
}>) {
  const router = useRouter();
  const [crawlerType, setCrawlerType] = useState<AdminSupplierCrawlerType>(
    source?.crawlerType ?? 'GENERIC_HTML',
  );
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const name = String(formData.get('name') ?? '').trim();
    const baseUrl = String(formData.get('baseUrl') ?? '').trim();
    const adapterKey = String(formData.get('adapterKey') ?? '').trim();
    const crawlDelayMs = parseNumber(String(formData.get('crawlDelayMs') ?? ''));
    const maxConcurrency = parseNumber(String(formData.get('maxConcurrency') ?? ''));
    if (!name || !baseUrl) return setError('نام و نشانی وب‌سایت الزامی است.');
    if (
      crawlDelayMs === null ||
      !Number.isInteger(crawlDelayMs) ||
      crawlDelayMs < 500 ||
      crawlDelayMs > 60_000
    )
      return setError('فاصله درخواست‌ها باید بین ۵۰۰ تا ۶۰٬۰۰۰ میلی‌ثانیه باشد.');
    if (
      maxConcurrency === null ||
      !Number.isInteger(maxConcurrency) ||
      maxConcurrency < 1 ||
      maxConcurrency > 5
    )
      return setError('تعداد درخواست هم‌زمان باید بین ۱ تا ۵ باشد.');
    if (crawlerType === 'CUSTOM_ADAPTER' && !adapterKey)
      return setError('برای آداپتر اختصاصی، کلید آداپتر را وارد کنید.');

    setError(null);
    onPendingChange(true);
    try {
      await requestJson(
        source
          ? `/api/pricing/suppliers/${supplier.id}/sources/${source.id}`
          : `/api/pricing/suppliers/${supplier.id}/sources`,
        source ? 'PATCH' : 'POST',
        {
          name,
          baseUrl,
          crawlerType,
          adapterKey: adapterKey || (source ? null : undefined),
          crawlDelayMs,
          maxConcurrency,
          isActive: formData.get('isActive') === 'on',
        },
      );
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
        <Alert tone="danger" title="ذخیره وب‌سایت ناموفق بود">
          {error}
        </Alert>
      ) : null}
      {!supplier.active ? (
        <Alert tone="warning">
          تا زمانی که تأمین‌کننده غیرفعال است، وب‌سایت نیز غیرفعال ذخیره می‌شود.
        </Alert>
      ) : null}
      <FormField id={`${formId}-name`} label="نام سایت" required>
        {(props) => (
          <Input
            {...props}
            name="name"
            defaultValue={source?.name ?? ''}
            placeholder="مثلاً فروشگاه اصلی تأمین‌کننده"
            required
          />
        )}
      </FormField>
      <FormField
        id={`${formId}-url`}
        label="نشانی سایت"
        hint="نشانی عمومی سایت یا مسیر پایه محصولات"
        required
      >
        {(props) => (
          <Input
            {...props}
            name="baseUrl"
            type="url"
            dir="ltr"
            defaultValue={source?.baseUrl ?? ''}
            placeholder="https://supplier.example.com/"
            required
          />
        )}
      </FormField>
      <FormField id={`${formId}-crawler`} label="نوع Crawler" required>
        {(props) => (
          <Select
            {...props}
            value={crawlerType}
            onValueChange={(value) => setCrawlerType(value as AdminSupplierCrawlerType)}
            options={crawlerTypeOptions}
            required
          />
        )}
      </FormField>
      {crawlerType === 'CUSTOM_ADAPTER' ? (
        <FormField
          id={`${formId}-adapter`}
          label="کلید آداپتر"
          hint="شناسه فنی آداپتر اختصاصی؛ مانند bsj-silver"
          required
        >
          {(props) => (
            <Input
              {...props}
              name="adapterKey"
              dir="ltr"
              defaultValue={source?.adapterKey ?? ''}
              placeholder="bsj-silver"
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              required
            />
          )}
        </FormField>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id={`${formId}-delay`}
          label="فاصله درخواست‌ها"
          hint="میلی‌ثانیه؛ حداقل ۵۰۰"
          required
        >
          {(props) => (
            <Input
              {...props}
              name="crawlDelayMs"
              type="number"
              dir="ltr"
              min={500}
              max={60000}
              step={100}
              defaultValue={source?.crawlDelayMs ?? 2000}
              required
            />
          )}
        </FormField>
        <FormField id={`${formId}-concurrency`} label="درخواست هم‌زمان" hint="بین ۱ تا ۵" required>
          {(props) => (
            <Input
              {...props}
              name="maxConcurrency"
              type="number"
              dir="ltr"
              min={1}
              max={5}
              defaultValue={source?.maxConcurrency ?? 1}
              required
            />
          )}
        </FormField>
      </div>
      <Checkbox
        id={`${formId}-active`}
        name="isActive"
        label="این سایت فعال باشد"
        description="فقط سایت‌های فعال در اجرای Crawl استفاده خواهند شد."
        defaultChecked={source?.active ?? true}
      />
    </form>
  );
}

function SupplierSourcesSheet({
  supplier,
  canWrite,
}: Readonly<{ supplier: AdminSupplier; canWrite: boolean }>) {
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list');
  const [selectedSource, setSelectedSource] = useState<AdminSupplierSource | undefined>();

  function changeOpen(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setMode('list');
      setSelectedSource(undefined);
    }
  }

  const editing = mode === 'edit' ? selectedSource : undefined;
  const formVisible = mode !== 'list';
  return (
    <BottomSheet open={open} onOpenChange={changeOpen}>
      <BottomSheetTrigger asChild>
        <Button variant="outline" size="sm">
          وب‌سایت‌ها
        </Button>
      </BottomSheetTrigger>
      <BottomSheetContent
        title={`وب‌سایت‌های ${supplier.name}`}
        description="منابع Crawl، نوع استخراج و سرعت درخواست‌ها را مدیریت کنید."
        height="large"
        footer={
          formVisible ? (
            <>
              <Button
                variant="outline"
                disabled={pending}
                onClick={() => {
                  setMode('list');
                  setSelectedSource(undefined);
                }}
              >
                بازگشت
              </Button>
              <Button type="submit" form={formId} loading={pending}>
                ذخیره وب‌سایت
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => changeOpen(false)}>
              بستن
            </Button>
          )
        }
      >
        {formVisible ? (
          <SupplierSourceForm
            key={editing?.id ?? 'new-source'}
            formId={formId}
            supplier={supplier}
            source={editing}
            onSaved={() => changeOpen(false)}
            onPendingChange={setPending}
          />
        ) : (
          <div className="space-y-4">
            {canWrite ? (
              <Button
                className="w-full"
                onClick={() => {
                  setSelectedSource(undefined);
                  setMode('create');
                }}
              >
                افزودن سایت تأمین‌کننده
              </Button>
            ) : null}
            {!supplier.sources.length ? (
              <Alert tone="info" title="هنوز سایتی ثبت نشده است">
                برای این تأمین‌کننده هیچ منبع Crawl تعریف نشده است.
              </Alert>
            ) : (
              <div className="space-y-3">
                {supplier.sources.map((source) => (
                  <Card key={source.id} className="space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-bold">{source.name}</p>
                        <a
                          href={source.baseUrl}
                          target="_blank"
                          rel="noreferrer"
                          dir="ltr"
                          className="mt-1 block truncate text-xs text-[var(--admin-color-info)] underline-offset-4 hover:underline"
                        >
                          {source.hostname}
                        </a>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge tone={source.active ? 'success' : 'neutral'} dot>
                          {source.active ? 'فعال' : 'غیرفعال'}
                        </Badge>
                        {crawlRunStatus(source)}
                      </div>
                    </div>
                    <dl className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
                      <div>
                        <dt className="text-[var(--admin-color-muted)]">نوع Crawler</dt>
                        <dd className="mt-1 font-semibold">
                          {crawlerTypeLabel(source.crawlerType)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[var(--admin-color-muted)]">فاصله درخواست</dt>
                        <dd className="mt-1 font-semibold">
                          {formatAdminInteger(source.crawlDelayMs)} میلی‌ثانیه
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[var(--admin-color-muted)]">آخرین اجرا</dt>
                        <dd className="mt-1 font-semibold">
                          {source.lastRun ? formatAdminDateTime(source.lastRun.createdAt) : '—'}
                        </dd>
                      </div>
                    </dl>
                    {canWrite ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedSource(source);
                          setMode('edit');
                        }}
                      >
                        ویرایش تنظیمات سایت
                      </Button>
                    ) : null}
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </BottomSheetContent>
    </BottomSheet>
  );
}

function ProductSupplierForm({
  formId,
  product,
  suppliers,
  onSaved,
  onPendingChange,
}: Readonly<{
  formId: string;
  product: AdminSupplierProduct;
  suppliers: readonly AdminSupplier[];
  onSaved: () => void;
  onPendingChange: (pending: boolean) => void;
}>) {
  const router = useRouter();
  const selectableSuppliers = suppliers.filter((supplier) => supplier.active);
  const initialLink =
    product.suppliers.find((link) => link.preferred && link.supplierActive) ??
    product.suppliers.find((link) => link.supplierActive);
  const initialSupplierId = initialLink?.supplierId ?? selectableSuppliers[0]?.id ?? '';
  const [supplierId, setSupplierId] = useState(initialSupplierId);
  const [price, setPrice] = useState(
    initialLink ? toPersianDigits(initialLink.supplierPriceToman) : '',
  );
  const [markup, setMarkup] = useState(
    initialLink?.markupPercent === null || initialLink?.markupPercent === undefined
      ? ''
      : toPersianDigits(initialLink.markupPercent).replace('.', '٫'),
  );
  const [active, setActive] = useState(initialLink?.active ?? true);
  const [preferred, setPreferred] = useState(initialLink?.preferred ?? false);
  const [error, setError] = useState<string | null>(null);

  function selectSupplier(value: string) {
    setSupplierId(value);
    const link = product.suppliers.find((item) => item.supplierId === value);
    setPrice(link ? toPersianDigits(link.supplierPriceToman) : '');
    setMarkup(
      link?.markupPercent === null || link?.markupPercent === undefined
        ? ''
        : toPersianDigits(link.markupPercent).replace('.', '٫'),
    );
    setActive(link?.active ?? true);
    setPreferred(link?.preferred ?? false);
    setError(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedPrice = parseNumber(price);
    const parsedMarkup = parseNumber(markup);
    if (!supplierId) return setError('یک تأمین‌کننده انتخاب کنید.');
    if (parsedPrice === null || !Number.isInteger(parsedPrice) || parsedPrice < 0)
      return setError('قیمت خرید باید یک عدد صحیح صفر یا بزرگ‌تر باشد.');
    if (markup && (parsedMarkup === null || parsedMarkup < 0 || parsedMarkup > 10000))
      return setError('درصد افزایش باید بین صفر تا ۱۰٬۰۰۰ باشد.');
    setError(null);
    onPendingChange(true);
    try {
      await requestJson(`/api/pricing/products/${product.id}/suppliers/${supplierId}`, 'PUT', {
        supplierPriceToman: parsedPrice,
        markupPercent: markup ? parsedMarkup : null,
        isPreferred: active && preferred,
        isActive: active,
      });
      onSaved();
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : apiError(null));
    } finally {
      onPendingChange(false);
    }
  }

  if (!selectableSuppliers.length)
    return (
      <Alert tone="warning" title="تأمین‌کننده فعالی وجود ندارد">
        ابتدا یک تأمین‌کننده فعال بسازید.
      </Alert>
    );
  return (
    <form id={formId} onSubmit={(event) => void submit(event)} className="space-y-4">
      {error ? (
        <Alert tone="danger" title="ذخیره قیمت خرید ناموفق بود">
          {error}
        </Alert>
      ) : null}
      <FormField id={`${formId}-supplier`} label="تأمین‌کننده" required>
        {(props) => (
          <Select
            {...props}
            value={supplierId}
            onValueChange={selectSupplier}
            options={selectableSuppliers.map((supplier) => ({
              value: supplier.id,
              label: `${supplier.name} — ${toPersianDigits(supplier.code)}`,
            }))}
            required
          />
        )}
      </FormField>
      <FormField id={`${formId}-price`} label="قیمت خرید" hint="مبلغ به تومان" required>
        {(props) => (
          <MoneyInput
            {...props}
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            placeholder="مثلاً ۸۵۰٬۰۰۰"
            required
          />
        )}
      </FormField>
      <FormField id={`${formId}-markup`} label="درصد افزایش قیمت" hint="اختیاری؛ تا سه رقم اعشار">
        {(props) => (
          <Input
            {...props}
            value={markup}
            onChange={(event) => setMarkup(normalizeNumericInput(event.target.value, true))}
            placeholder="مثلاً ۲۵"
            inputMode="decimal"
          />
        )}
      </FormField>
      <Checkbox
        id={`${formId}-active`}
        label="این اتصال فعال باشد"
        checked={active}
        onChange={(event) => {
          setActive(event.target.checked);
          if (!event.target.checked) setPreferred(false);
        }}
      />
      <Checkbox
        id={`${formId}-preferred`}
        label="تأمین‌کننده منتخب این محصول"
        description="در سفارش‌های جدید این قیمت خرید ثبت می‌شود."
        checked={preferred}
        disabled={!active}
        onChange={(event) => setPreferred(event.target.checked)}
      />
    </form>
  );
}

function ProductSupplierSheet({
  product,
  suppliers,
  triggerLabel,
}: Readonly<{
  product: AdminSupplierProduct;
  suppliers: readonly AdminSupplier[];
  triggerLabel: string;
}>) {
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  return (
    <BottomSheet open={open} onOpenChange={setOpen}>
      <BottomSheetTrigger asChild>
        <Button variant="outline" size="sm">
          {triggerLabel}
        </Button>
      </BottomSheetTrigger>
      <BottomSheetContent
        title={product.name}
        description="قیمت خرید، درصد افزایش و منبع منتخب محصول را مدیریت کنید."
        height="large"
        footer={
          <>
            <Button variant="outline" disabled={pending} onClick={() => setOpen(false)}>
              انصراف
            </Button>
            <Button type="submit" form={formId} loading={pending}>
              ذخیره منبع تأمین
            </Button>
          </>
        }
      >
        <ProductSupplierForm
          formId={formId}
          product={product}
          suppliers={suppliers}
          onSaved={() => setOpen(false)}
          onPendingChange={setPending}
        />
      </BottomSheetContent>
    </BottomSheet>
  );
}

function SupplierReadonlyDetails({
  supplier,
  products,
}: Readonly<{ supplier: AdminSupplier; products: readonly AdminSupplierProduct[] }>) {
  const links = products.flatMap((product) =>
    product.suppliers.filter((link) => link.supplierId === supplier.id),
  );
  return (
    <dl className="divide-y divide-[var(--admin-color-border)]">
      {[
        ['نام', supplier.name],
        ['کد', toPersianDigits(supplier.code)],
        ['مسئول ارتباط', supplier.contactName ?? 'ثبت نشده'],
        ['تلفن', supplier.phone ? formatAdminPhone(supplier.phone) : 'ثبت نشده'],
        ['وب‌سایت Crawl', formatAdminInteger(supplier.sources.length)],
        ['محصول متصل', formatAdminInteger(links.length)],
        [
          'تأمین منتخب',
          formatAdminInteger(links.filter((link) => link.preferred && link.active).length),
        ],
        ['آخرین تغییر', formatAdminDateTime(supplier.updatedAt)],
      ].map(([label, value]) => (
        <div key={label} className="flex justify-between gap-4 py-3 text-sm">
          <dt className="text-[var(--admin-color-muted)]">{label}</dt>
          <dd className="max-w-[65%] text-left font-semibold">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function ProductReadonlyDetails({ product }: Readonly<{ product: AdminSupplierProduct }>) {
  const preferred = preferredSupplier(product);
  return (
    <dl className="divide-y divide-[var(--admin-color-border)]">
      {[
        ['محصول', product.name],
        [
          'وضعیت',
          product.status === 'ACTIVE'
            ? 'منتشرشده'
            : product.status === 'DRAFT'
              ? 'پیش‌نویس'
              : 'آرشیوشده',
        ],
        [
          'قیمت فروش',
          product.salePriceToman === null ? 'ثبت نشده' : formatAdminToman(product.salePriceToman),
        ],
        [
          'تأمین‌کنندگان فعال',
          formatAdminInteger(
            product.suppliers.filter((link) => link.active && link.supplierActive).length,
          ),
        ],
        ['تأمین‌کننده منتخب', preferred?.supplierName ?? 'انتخاب نشده'],
        [
          'قیمت خرید منتخب',
          preferred ? formatAdminToman(preferred.supplierPriceToman) : 'ثبت نشده',
        ],
      ].map(([label, value]) => (
        <div key={label} className="flex justify-between gap-4 py-3 text-sm">
          <dt className="text-[var(--admin-color-muted)]">{label}</dt>
          <dd className="max-w-[65%] text-left font-semibold">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function SupplierMobileCard({
  supplier,
  products,
  canWrite,
}: Readonly<{
  supplier: AdminSupplier;
  products: readonly AdminSupplierProduct[];
  canWrite: boolean;
}>) {
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const links = products.flatMap((product) =>
    product.suppliers.filter((link) => link.supplierId === supplier.id),
  );
  return (
    <MobileDataCard
      eyebrow={toPersianDigits(supplier.code)}
      title={supplier.name}
      status={supplierStatus(supplier)}
      items={[
        { label: 'مسئول ارتباط', value: supplier.contactName ?? 'ثبت نشده' },
        { label: 'وب‌سایت Crawl', value: formatAdminInteger(supplier.sources.length) },
        { label: 'محصول متصل', value: formatAdminInteger(links.length) },
        {
          label: 'تأمین منتخب',
          value: formatAdminInteger(links.filter((link) => link.preferred && link.active).length),
        },
      ]}
      detailsTitle={supplier.name}
      detailsDescription="مشخصات و وضعیت همکاری"
      detailsOpen={open}
      onDetailsOpenChange={setOpen}
      details={
        canWrite ? (
          <SupplierForm
            formId={formId}
            supplier={supplier}
            onSaved={() => setOpen(false)}
            onPendingChange={setPending}
          />
        ) : (
          <SupplierReadonlyDetails supplier={supplier} products={products} />
        )
      }
      detailsFooter={
        <>
          <SupplierSourcesSheet supplier={supplier} canWrite={canWrite} />
          {canWrite ? (
            <Button type="submit" form={formId} loading={pending}>
              ذخیره تغییرات
            </Button>
          ) : null}
        </>
      }
    />
  );
}

function ProductMobileCard({
  product,
  suppliers,
  canWrite,
}: Readonly<{
  product: AdminSupplierProduct;
  suppliers: readonly AdminSupplier[];
  canWrite: boolean;
}>) {
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const preferred = preferredSupplier(product);
  return (
    <MobileDataCard
      eyebrow={productStatus(product.status)}
      title={product.name}
      status={
        preferred ? (
          <Badge tone="success" dot>
            منبع منتخب
          </Badge>
        ) : (
          <Badge tone="warning" dot>
            بدون منبع
          </Badge>
        )
      }
      items={[
        { label: 'تأمین‌کننده', value: preferred?.supplierName ?? 'انتخاب نشده' },
        {
          label: 'قیمت خرید',
          value: preferred ? formatAdminToman(preferred.supplierPriceToman) : '—',
        },
        {
          label: 'قیمت فروش',
          value: product.salePriceToman === null ? '—' : formatAdminToman(product.salePriceToman),
        },
      ]}
      detailsTitle={product.name}
      detailsDescription="جزئیات قیمت خرید و منبع تأمین"
      detailsOpen={open}
      onDetailsOpenChange={setOpen}
      details={
        canWrite ? (
          <ProductSupplierForm
            formId={formId}
            product={product}
            suppliers={suppliers}
            onSaved={() => setOpen(false)}
            onPendingChange={setPending}
          />
        ) : (
          <ProductReadonlyDetails product={product} />
        )
      }
      detailsFooter={
        canWrite ? (
          <Button type="submit" form={formId} loading={pending}>
            ذخیره منبع تأمین
          </Button>
        ) : undefined
      }
    />
  );
}

export function SupplierManagementView({
  suppliers,
  products,
  failed,
  canWrite,
}: SupplierManagementViewProps) {
  const [supplierQuery, setSupplierQuery] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [productQuery, setProductQuery] = useState('');
  const [productFilter, setProductFilter] = useState('all');
  const supplierLinks = useMemo(() => products.flatMap((product) => product.suppliers), [products]);
  const filteredSuppliers = useMemo(
    () =>
      suppliers.filter((supplier) => {
        const query = toAsciiDigits(supplierQuery.trim()).toLocaleLowerCase('fa');
        const haystack =
          `${supplier.name} ${supplier.code} ${supplier.contactName ?? ''} ${supplier.phone ?? ''}`.toLocaleLowerCase(
            'fa',
          );
        return (
          (!query || haystack.includes(query)) &&
          (supplierFilter === 'all' ||
            (supplierFilter === 'active' ? supplier.active : !supplier.active))
        );
      }),
    [supplierFilter, supplierQuery, suppliers],
  );
  const filteredProducts = useMemo(
    () =>
      products.filter((product) => {
        const query = toAsciiDigits(productQuery.trim()).toLocaleLowerCase('fa');
        const preferred = preferredSupplier(product);
        const activeCount = product.suppliers.filter(
          (link) => link.active && link.supplierActive,
        ).length;
        const haystack =
          `${product.name} ${product.slug} ${product.suppliers.map((link) => `${link.supplierName} ${link.supplierCode}`).join(' ')}`.toLocaleLowerCase(
            'fa',
          );
        const matchesFilter =
          productFilter === 'all' ||
          (productFilter === 'missing' && !preferred) ||
          (productFilter === 'preferred' && preferred) ||
          (productFilter === 'multiple' && activeCount > 1);
        return (!query || haystack.includes(query)) && matchesFilter;
      }),
    [productFilter, productQuery, products],
  );
  const supplierColumns: readonly DataTableColumn<AdminSupplier>[] = [
    {
      id: 'supplier',
      header: 'تأمین‌کننده',
      cell: (supplier) => (
        <div>
          <p className="font-bold">{supplier.name}</p>
          <p className="mt-1 text-xs text-[var(--admin-color-muted)]">
            {toPersianDigits(supplier.code)}
          </p>
        </div>
      ),
    },
    {
      id: 'contact',
      header: 'ارتباط',
      cell: (supplier) => (
        <div>
          <p>{supplier.contactName ?? 'ثبت نشده'}</p>
          <p className="mt-1 text-xs text-[var(--admin-color-muted)]">
            {supplier.phone ? formatAdminPhone(supplier.phone) : 'بدون شماره'}
          </p>
        </div>
      ),
    },
    {
      id: 'sources',
      header: 'وب‌سایت Crawl',
      cell: (supplier) => (
        <div>
          <p className="font-semibold">{formatAdminInteger(supplier.sources.length)}</p>
          <p className="mt-1 text-xs text-[var(--admin-color-muted)]">
            {formatAdminInteger(supplier.sources.filter((source) => source.active).length)} فعال
          </p>
        </div>
      ),
      align: 'center',
    },
    {
      id: 'products',
      header: 'محصول',
      cell: (supplier) =>
        formatAdminInteger(supplierLinks.filter((link) => link.supplierId === supplier.id).length),
      align: 'center',
    },
    {
      id: 'preferred',
      header: 'منتخب',
      cell: (supplier) =>
        formatAdminInteger(
          supplierLinks.filter(
            (link) =>
              link.supplierId === supplier.id &&
              link.preferred &&
              link.active &&
              link.supplierActive,
          ).length,
        ),
      align: 'center',
    },
    { id: 'status', header: 'وضعیت', cell: supplierStatus },
    {
      id: 'action',
      header: 'عملیات',
      cell: (supplier) =>
        canWrite ? (
          <div className="flex justify-end gap-2">
            <SupplierSourcesSheet supplier={supplier} canWrite />
            <SupplierSheet supplier={supplier} triggerLabel="ویرایش" />
          </div>
        ) : (
          <SupplierSourcesSheet supplier={supplier} canWrite={false} />
        ),
      align: 'end',
    },
  ];
  const productColumns: readonly DataTableColumn<AdminSupplierProduct>[] = [
    {
      id: 'product',
      header: 'محصول',
      cell: (product) => (
        <div>
          <p className="font-bold">{product.name}</p>
          <div className="mt-1">{productStatus(product.status)}</div>
        </div>
      ),
    },
    {
      id: 'supplier',
      header: 'تأمین‌کننده منتخب',
      cell: (product) =>
        preferredSupplier(product)?.supplierName ?? (
          <span className="text-[var(--admin-color-danger)]">انتخاب نشده</span>
        ),
    },
    {
      id: 'cost',
      header: 'قیمت خرید',
      cell: (product) => {
        const preferred = preferredSupplier(product);
        return preferred ? formatAdminToman(preferred.supplierPriceToman) : '—';
      },
      align: 'center',
    },
    {
      id: 'sale',
      header: 'قیمت فروش',
      cell: (product) =>
        product.salePriceToman === null ? 'ثبت نشده' : formatAdminToman(product.salePriceToman),
      align: 'center',
    },
    {
      id: 'margin',
      header: 'فاصله قیمت',
      cell: (product) => {
        const preferred = preferredSupplier(product);
        if (!preferred || product.salePriceToman === null) return '—';
        const margin = product.salePriceToman - preferred.supplierPriceToman;
        return (
          <span
            className={
              margin < 0
                ? 'font-bold text-[var(--admin-color-danger)]'
                : 'font-bold text-[var(--admin-color-success)]'
            }
          >
            {formatAdminToman(margin)}
          </span>
        );
      },
      align: 'center',
    },
    {
      id: 'action',
      header: 'عملیات',
      cell: (product) =>
        canWrite ? (
          <ProductSupplierSheet
            product={product}
            suppliers={suppliers}
            triggerLabel="مدیریت تأمین"
          />
        ) : (
          <span className="text-xs text-[var(--admin-color-subtle)]">فقط مشاهده</span>
        ),
      align: 'end',
    },
  ];

  if (failed)
    return (
      <div className="mt-6">
        <Alert tone="danger" title="دریافت اطلاعات ناموفق بود">
          اطلاعات تأمین‌کنندگان و محصولات از سرور دریافت نشد.
        </Alert>
      </div>
    );
  return (
    <div className="mt-6 space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Card>
          <p className="text-xs text-[var(--admin-color-muted)]">تأمین‌کننده فعال</p>
          <p className="mt-2 text-2xl font-black">
            {formatAdminInteger(suppliers.filter((supplier) => supplier.active).length)}
          </p>
        </Card>
        <Card>
          <p className="text-xs text-[var(--admin-color-muted)]">سایت Crawl فعال</p>
          <p className="mt-2 text-2xl font-black">
            {formatAdminInteger(
              suppliers.flatMap((supplier) => supplier.sources).filter((source) => source.active)
                .length,
            )}
          </p>
        </Card>
        <Card>
          <p className="text-xs text-[var(--admin-color-muted)]">محصول دارای منبع</p>
          <p className="mt-2 text-2xl font-black text-[var(--admin-color-success)]">
            {formatAdminInteger(products.filter((product) => preferredSupplier(product)).length)}
          </p>
        </Card>
        <Card
          className={
            products.some((product) => !preferredSupplier(product)) ? 'border-amber-200' : undefined
          }
        >
          <p className="text-xs text-[var(--admin-color-muted)]">بدون منبع منتخب</p>
          <p className="mt-2 text-2xl font-black text-[var(--admin-color-warning)]">
            {formatAdminInteger(products.filter((product) => !preferredSupplier(product)).length)}
          </p>
        </Card>
        <Card>
          <p className="text-xs text-[var(--admin-color-muted)]">اتصال فعال</p>
          <p className="mt-2 text-2xl font-black">
            {formatAdminInteger(
              supplierLinks.filter((link) => link.active && link.supplierActive).length,
            )}
          </p>
        </Card>
      </div>

      <section aria-labelledby="supplier-directory-heading" className="space-y-4">
        <div>
          <h2 id="supplier-directory-heading" className="text-lg font-black">
            فهرست تأمین‌کنندگان
          </h2>
          <p className="mt-1 text-xs text-[var(--admin-color-muted)]">
            مشخصات ارتباطی و وضعیت همکاری
          </p>
        </div>
        <FilterBar
          actions={canWrite ? <SupplierSheet triggerLabel="افزودن تأمین‌کننده" /> : null}
          activeCount={
            [supplierQuery.trim(), supplierFilter === 'all' ? '' : supplierFilter].filter(Boolean)
              .length
          }
          resetAction={
            supplierQuery.trim() || supplierFilter !== 'all' ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSupplierQuery('');
                  setSupplierFilter('all');
                }}
              >
                پاک‌کردن فیلترها
              </Button>
            ) : undefined
          }
        >
          <SearchField
            value={supplierQuery}
            onChange={(event) => setSupplierQuery(toPersianDigits(event.target.value))}
            placeholder="جستجو در نام، کد یا شماره"
            aria-label="جستجوی تأمین‌کننده"
          />
          <Select
            value={supplierFilter}
            onValueChange={setSupplierFilter}
            aria-label="فیلتر وضعیت تأمین‌کننده"
            options={[
              { value: 'all', label: 'همه وضعیت‌ها' },
              { value: 'active', label: 'فعال' },
              { value: 'inactive', label: 'غیرفعال' },
            ]}
          />
        </FilterBar>
        <ResponsiveDataView
          mobileLabel="کارت‌های تأمین‌کننده"
          renderMobileCard={(supplier) => (
            <SupplierMobileCard supplier={supplier} products={products} canWrite={canWrite} />
          )}
          caption="جدول تأمین‌کنندگان"
          columns={supplierColumns}
          rows={filteredSuppliers}
          getRowKey={(supplier) => supplier.id}
          emptyTitle="تأمین‌کننده‌ای پیدا نشد"
          emptyDescription="فیلترها را تغییر دهید یا تأمین‌کننده جدید بسازید."
          compact
        />
      </section>

      <section aria-labelledby="product-sourcing-heading" className="space-y-4">
        <div>
          <h2 id="product-sourcing-heading" className="text-lg font-black">
            منبع تأمین محصولات
          </h2>
          <p className="mt-1 text-xs text-[var(--admin-color-muted)]">
            قیمت خرید و تأمین‌کننده منتخب هر محصول
          </p>
        </div>
        <FilterBar
          activeCount={
            [productQuery.trim(), productFilter === 'all' ? '' : productFilter].filter(Boolean)
              .length
          }
          resetAction={
            productQuery.trim() || productFilter !== 'all' ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setProductQuery('');
                  setProductFilter('all');
                }}
              >
                پاک‌کردن فیلترها
              </Button>
            ) : undefined
          }
        >
          <SearchField
            value={productQuery}
            onChange={(event) => setProductQuery(toPersianDigits(event.target.value))}
            placeholder="جستجو در محصول یا تأمین‌کننده"
            aria-label="جستجوی منبع تأمین محصول"
          />
          <Select
            value={productFilter}
            onValueChange={setProductFilter}
            aria-label="فیلتر منبع تأمین"
            options={[
              { value: 'all', label: 'همه محصولات' },
              { value: 'missing', label: 'بدون منبع منتخب' },
              { value: 'preferred', label: 'دارای منبع منتخب' },
              { value: 'multiple', label: 'چند تأمین‌کننده فعال' },
            ]}
          />
        </FilterBar>
        <ResponsiveDataView
          mobileLabel="کارت‌های منبع تأمین محصول"
          renderMobileCard={(product) => (
            <ProductMobileCard product={product} suppliers={suppliers} canWrite={canWrite} />
          )}
          caption="جدول منبع تأمین محصولات"
          columns={productColumns}
          rows={filteredProducts}
          getRowKey={(product) => product.id}
          emptyTitle="محصولی پیدا نشد"
          emptyDescription="فیلترها را تغییر دهید."
          compact
        />
      </section>
    </div>
  );
}
