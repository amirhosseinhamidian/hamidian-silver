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
import { Input, Textarea } from '@/components/ui/form-control';
import { FormField } from '@/components/ui/form-field';
import { MobileDataCard } from '@/components/ui/mobile-data-card';
import { ResponsiveDataView } from '@/components/ui/responsive-data-view';
import { Select } from '@/components/ui/select';
import type { AdminInventoryItem, AdminWarehouse } from '@/lib/inventory/inventory-model';
import {
  formatAdminDateTime,
  formatAdminInteger,
  toAsciiDigits,
  toPersianDigits,
} from '@/lib/presentation/formatters';

type InventoryManagementViewProps = Readonly<{
  warehouses: readonly AdminWarehouse[];
  items: readonly AdminInventoryItem[];
  selectedWarehouseId: string | null;
  warehousesFailed: boolean;
  itemsFailed: boolean;
  canWrite: boolean;
}>;

function apiError(payload: unknown): string {
  const translations: Record<string, string> = {
    'Warehouse was not found.': 'انبار پیدا نشد یا دیگر در دسترس نیست.',
    'Product variant was not found.': 'تنوع محصول پیدا نشد یا غیرفعال است.',
    'Stock cannot be reduced below zero.': 'موجودی واقعی نمی‌تواند منفی شود.',
    'On-hand stock cannot be lower than reserved stock.':
      'موجودی واقعی نمی‌تواند از موجودی رزروشده کمتر باشد.',
    'Inventory changed while adjusting stock; reload and retry.':
      'موجودی هم‌زمان تغییر کرده است؛ صفحه را تازه‌سازی و دوباره تلاش کنید.',
    'Another warehouse already uses this code.': 'این کد قبلاً برای انبار دیگری استفاده شده است.',
    'The default warehouse must be active.': 'انبار پیش‌فرض باید فعال باشد.',
    'Select another default warehouse before removing this default.':
      'پیش از برداشتن حالت پیش‌فرض، انبار دیگری را پیش‌فرض کنید.',
  };
  if (typeof payload === 'object' && payload !== null) {
    const value = payload as Record<string, unknown>;
    if (typeof value.message === 'string') return translations[value.message] ?? value.message;
    if (Array.isArray(value.message)) return value.message.join('، ');
    const nested = value.error as Record<string, unknown> | undefined;
    if (typeof nested?.message === 'string') return translations[nested.message] ?? nested.message;
  }
  return 'عملیات انبار انجام نشد. دوباره تلاش کنید.';
}

async function requestJson(path: string, method: 'POST' | 'PATCH', body: unknown) {
  const response = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) throw new Error(apiError(payload));
  return payload;
}

function parseInteger(value: string): number | null {
  const normalized = toAsciiDigits(value).replace(/[٬,\s]/g, '');
  if (!/^-?\d+$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function localizedInteger(value: string): string {
  const normalized = toAsciiDigits(value).replace(/[^\d-]/g, '');
  return toPersianDigits(
    normalized.startsWith('-') ? `-${normalized.slice(1).replace(/-/g, '')}` : normalized,
  );
}

function stockBadge(item: AdminInventoryItem) {
  if (!item.variantActive || item.productStatus === 'ARCHIVED') {
    return <Badge tone="neutral">غیرفعال</Badge>;
  }
  if (item.available <= 0)
    return (
      <Badge tone="danger" dot>
        ناموجود
      </Badge>
    );
  if (item.isLowStock)
    return (
      <Badge tone="warning" dot>
        کم‌موجود
      </Badge>
    );
  return (
    <Badge tone="success" dot>
      موجود
    </Badge>
  );
}

function itemTitle(item: AdminInventoryItem): string {
  return item.variantName ?? item.sizeLabel ?? 'تنوع اصلی';
}

function WarehouseForm({
  formId,
  warehouse,
  onSaved,
  onPendingChange,
}: Readonly<{
  formId: string;
  warehouse?: AdminWarehouse;
  onSaved: () => void;
  onPendingChange: (pending: boolean) => void;
}>) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const code = String(formData.get('code') ?? '')
      .trim()
      .toUpperCase();
    const name = String(formData.get('name') ?? '').trim();
    if (!code || !name) return setError('نام و کد انبار الزامی است.');
    const isDefault = warehouse?.isDefault || formData.get('isDefault') === 'on';
    const isActive = warehouse?.isDefault || formData.get('isActive') === 'on';
    if (isDefault && !isActive) return setError('انبار پیش‌فرض باید فعال باشد.');

    setError(null);
    onPendingChange(true);
    try {
      await requestJson(
        warehouse ? `/api/inventory/warehouses/${warehouse.id}` : '/api/inventory/warehouses',
        warehouse ? 'PATCH' : 'POST',
        { code, name, isDefault, isActive },
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
        <Alert tone="danger" title="ذخیره انبار ناموفق بود">
          {error}
        </Alert>
      ) : null}
      <FormField id={`${formId}-name`} label="نام انبار" required>
        {(props) => (
          <Input
            {...props}
            name="name"
            defaultValue={warehouse?.name}
            placeholder="مثلاً انبار مرکزی"
            required
          />
        )}
      </FormField>
      <FormField id={`${formId}-code`} label="کد انبار" hint="یک شناسه کوتاه و یکتا" required>
        {(props) => (
          <Input
            {...props}
            name="code"
            defaultValue={warehouse?.code}
            placeholder="مثلاً MAIN"
            dir="ltr"
            maxLength={64}
            required
          />
        )}
      </FormField>
      <Checkbox
        id={`${formId}-active`}
        name="isActive"
        label="انبار فعال باشد"
        description={
          warehouse?.isDefault
            ? 'انبار پیش‌فرض را نمی‌توان غیرفعال کرد.'
            : 'انبار غیرفعال برای عملیات موجودی قابل استفاده نیست.'
        }
        defaultChecked={warehouse?.isActive ?? true}
        disabled={warehouse?.isDefault}
      />
      <Checkbox
        id={`${formId}-default`}
        name="isDefault"
        label="انبار پیش‌فرض"
        description={
          warehouse?.isDefault
            ? 'برای تغییر، انبار دیگری را پیش‌فرض کنید.'
            : 'انبار قبلی به‌صورت خودکار از حالت پیش‌فرض خارج می‌شود.'
        }
        defaultChecked={warehouse?.isDefault ?? false}
        disabled={warehouse?.isDefault}
      />
    </form>
  );
}

function WarehouseSheet({
  warehouse,
  triggerLabel,
}: Readonly<{ warehouse?: AdminWarehouse; triggerLabel: string }>) {
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  return (
    <BottomSheet open={open} onOpenChange={setOpen}>
      <BottomSheetTrigger asChild>
        <Button variant={warehouse ? 'outline' : 'primary'} size="sm">
          {triggerLabel}
        </Button>
      </BottomSheetTrigger>
      <BottomSheetContent
        title={warehouse ? `ویرایش ${warehouse.name}` : 'افزودن انبار'}
        description="مشخصات و وضعیت عملیاتی انبار را ثبت کنید."
        footer={
          <>
            <Button variant="outline" disabled={pending} onClick={() => setOpen(false)}>
              انصراف
            </Button>
            <Button type="submit" form={formId} loading={pending}>
              ذخیره انبار
            </Button>
          </>
        }
      >
        <WarehouseForm
          formId={formId}
          warehouse={warehouse}
          onSaved={() => setOpen(false)}
          onPendingChange={setPending}
        />
      </BottomSheetContent>
    </BottomSheet>
  );
}

function StockOperations({ item }: Readonly<{ item: AdminInventoryItem }>) {
  const router = useRouter();
  const [delta, setDelta] = useState('');
  const [threshold, setThreshold] = useState(toPersianDigits(item.lowStockThreshold));
  const [adjustPending, setAdjustPending] = useState(false);
  const [thresholdPending, setThresholdPending] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);
  const [thresholdError, setThresholdError] = useState<string | null>(null);
  const mutable = item.variantActive && item.productStatus !== 'ARCHIVED';

  async function adjust(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const parsedDelta = parseInteger(delta);
    const formData = new FormData(form);
    const reason = String(formData.get('reason') ?? '').trim();
    if (parsedDelta === null || parsedDelta === 0)
      return setAdjustError('مقدار تغییر باید عددی غیر از صفر باشد.');
    if (item.onHand + parsedDelta < item.reserved) {
      return setAdjustError('موجودی نهایی نمی‌تواند از تعداد رزروشده کمتر باشد.');
    }
    if (!reason) return setAdjustError('ثبت دلیل اصلاح موجودی الزامی است.');
    setAdjustError(null);
    setAdjustPending(true);
    try {
      await requestJson('/api/inventory/stock/adjust', 'POST', {
        warehouseId: item.warehouseId,
        variantId: item.variantId,
        onHandDelta: parsedDelta,
        reason,
      });
      setDelta('');
      form.reset();
      router.refresh();
    } catch (caught) {
      setAdjustError(caught instanceof Error ? caught.message : apiError(null));
    } finally {
      setAdjustPending(false);
    }
  }

  async function updateThreshold(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = parseInteger(threshold);
    if (parsed === null || parsed < 0)
      return setThresholdError('نقطه هشدار باید صفر یا بیشتر باشد.');
    setThresholdError(null);
    setThresholdPending(true);
    try {
      await requestJson('/api/inventory/stock/threshold', 'PATCH', {
        warehouseId: item.warehouseId,
        variantId: item.variantId,
        lowStockThreshold: parsed,
      });
      router.refresh();
    } catch (caught) {
      setThresholdError(caught instanceof Error ? caught.message : apiError(null));
    } finally {
      setThresholdPending(false);
    }
  }

  if (!mutable) {
    return (
      <Alert tone="warning" title="تنوع غیرفعال است">
        برای اصلاح موجودی، ابتدا تنوع محصول را فعال کنید.
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <Card title="اصلاح موجودی" description="مقدار مثبت برای افزایش و مقدار منفی برای کاهش">
        <form onSubmit={(event) => void adjust(event)} className="space-y-3">
          {adjustError ? <Alert tone="danger">{adjustError}</Alert> : null}
          <div className="grid grid-cols-3 gap-2" aria-label="تغییر سریع موجودی">
            {[-1, 1, 10].map((value) => (
              <Button
                key={value}
                variant="outline"
                size="sm"
                onClick={() => setDelta(toPersianDigits(value))}
              >
                {value > 0 ? '+' : ''}
                {formatAdminInteger(value)}
              </Button>
            ))}
          </div>
          <FormField id={`delta-${item.variantId}`} label="مقدار تغییر" required>
            {(props) => (
              <Input
                {...props}
                value={delta}
                onChange={(event) => setDelta(localizedInteger(event.target.value))}
                placeholder="مثلاً ۱۰ یا ۲-"
                inputMode="numeric"
                dir="ltr"
                required
              />
            )}
          </FormField>
          <FormField id={`reason-${item.variantId}`} label="دلیل اصلاح" required>
            {(props) => (
              <Textarea
                {...props}
                name="reason"
                placeholder="مثلاً دریافت از تأمین‌کننده یا اصلاح شمارش"
                maxLength={500}
                required
              />
            )}
          </FormField>
          <Button type="submit" loading={adjustPending} className="w-full">
            ثبت اصلاح موجودی
          </Button>
        </form>
      </Card>

      <Card
        title="نقطه هشدار"
        description="وقتی موجودی قابل فروش به این مقدار برسد هشدار نمایش داده می‌شود"
      >
        <form onSubmit={(event) => void updateThreshold(event)} className="space-y-3">
          {thresholdError ? <Alert tone="danger">{thresholdError}</Alert> : null}
          <FormField id={`threshold-${item.variantId}`} label="حداقل موجودی" required>
            {(props) => (
              <Input
                {...props}
                value={threshold}
                onChange={(event) =>
                  setThreshold(localizedInteger(event.target.value).replace('-', ''))
                }
                placeholder="مثلاً ۳"
                inputMode="numeric"
                required
              />
            )}
          </FormField>
          <Button type="submit" variant="outline" loading={thresholdPending} className="w-full">
            ذخیره نقطه هشدار
          </Button>
        </form>
      </Card>
    </div>
  );
}

function StockDetails({
  item,
  canWrite,
}: Readonly<{ item: AdminInventoryItem; canWrite: boolean }>) {
  const details: Array<[string, string]> = [
    ['محصول', item.productName],
    ['تنوع', itemTitle(item)],
    ['SKU', toPersianDigits(item.sku)],
    ['موجودی واقعی', formatAdminInteger(item.onHand)],
    ['رزروشده', formatAdminInteger(item.reserved)],
    ['قابل فروش', formatAdminInteger(item.available)],
    ['نقطه هشدار', formatAdminInteger(item.lowStockThreshold)],
    ['آخرین تغییر', item.updatedAt ? formatAdminDateTime(item.updatedAt) : 'هنوز ثبت نشده'],
  ];
  return (
    <div className="space-y-5">
      <dl className="divide-y divide-[var(--admin-color-border)]">
        {details.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4 py-3 text-sm">
            <dt className="text-[var(--admin-color-muted)]">{label}</dt>
            <dd className="max-w-[65%] text-left font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
      {canWrite ? (
        <StockOperations item={item} />
      ) : (
        <Alert tone="info">دسترسی شما برای این بخش فقط مشاهده است.</Alert>
      )}
    </div>
  );
}

function StockSheet({ item, canWrite }: Readonly<{ item: AdminInventoryItem; canWrite: boolean }>) {
  return (
    <BottomSheet>
      <BottomSheetTrigger asChild>
        <Button size="sm" variant="outline">
          {canWrite ? 'عملیات' : 'جزئیات'}
        </Button>
      </BottomSheetTrigger>
      <BottomSheetContent
        title={`${item.productName} — ${itemTitle(item)}`}
        description={`کد کالا: ${toPersianDigits(item.sku)}`}
        height="large"
      >
        <StockDetails item={item} canWrite={canWrite} />
      </BottomSheetContent>
    </BottomSheet>
  );
}

function StockMobileCard({
  item,
  canWrite,
}: Readonly<{ item: AdminInventoryItem; canWrite: boolean }>) {
  return (
    <MobileDataCard
      eyebrow={toPersianDigits(item.sku)}
      title={item.productName}
      status={stockBadge(item)}
      items={[
        { label: 'تنوع', value: itemTitle(item) },
        { label: 'قابل فروش', value: formatAdminInteger(item.available) },
        { label: 'رزروشده', value: formatAdminInteger(item.reserved) },
        { label: 'هشدار', value: formatAdminInteger(item.lowStockThreshold) },
      ]}
      detailsTitle={item.productName}
      detailsDescription={`جزئیات موجودی ${itemTitle(item)}`}
      details={<StockDetails item={item} canWrite={canWrite} />}
    />
  );
}

export function InventoryManagementView({
  warehouses,
  items,
  selectedWarehouseId,
  warehousesFailed,
  itemsFailed,
  canWrite,
}: InventoryManagementViewProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const selectedWarehouse = warehouses.find((item) => item.id === selectedWarehouseId);
  const normalizedQuery = toAsciiDigits(query.trim()).toLocaleLowerCase('fa');
  const filtered = useMemo(
    () =>
      items.filter((item) => {
        const haystack =
          `${item.productName} ${item.sku} ${item.variantName ?? ''} ${item.sizeLabel ?? ''}`.toLocaleLowerCase(
            'fa',
          );
        const matchesQuery = !normalizedQuery || haystack.includes(normalizedQuery);
        const matchesStatus =
          status === 'all' ||
          (status === 'out' && item.available <= 0) ||
          (status === 'low' && item.available > 0 && item.isLowStock) ||
          (status === 'reserved' && item.reserved > 0) ||
          (status === 'healthy' && item.available > 0 && !item.isLowStock);
        return matchesQuery && matchesStatus;
      }),
    [items, normalizedQuery, status],
  );
  const activeFilterCount = [normalizedQuery, status === 'all' ? '' : status].filter(
    Boolean,
  ).length;
  const columns: readonly DataTableColumn<AdminInventoryItem>[] = [
    {
      id: 'product',
      header: 'محصول و تنوع',
      cell: (item) => (
        <div>
          <p className="font-bold">{item.productName}</p>
          <p className="mt-1 text-xs text-[var(--admin-color-muted)]">
            {itemTitle(item)} · {toPersianDigits(item.sku)}
          </p>
        </div>
      ),
    },
    {
      id: 'onHand',
      header: 'واقعی',
      cell: (item) => formatAdminInteger(item.onHand),
      align: 'center',
    },
    {
      id: 'reserved',
      header: 'رزروشده',
      cell: (item) => formatAdminInteger(item.reserved),
      align: 'center',
    },
    {
      id: 'available',
      header: 'قابل فروش',
      cell: (item) => (
        <span className="text-base font-black">{formatAdminInteger(item.available)}</span>
      ),
      align: 'center',
    },
    {
      id: 'threshold',
      header: 'نقطه هشدار',
      cell: (item) => formatAdminInteger(item.lowStockThreshold),
      align: 'center',
    },
    { id: 'status', header: 'وضعیت', cell: stockBadge },
    {
      id: 'actions',
      header: 'عملیات',
      cell: (item) => (
        <StockSheet item={item} canWrite={canWrite && Boolean(selectedWarehouse?.isActive)} />
      ),
      align: 'end',
    },
  ];

  if (warehousesFailed) {
    return (
      <div className="mt-6">
        <Alert tone="danger" title="دریافت انبارها ناموفق بود">
          ارتباط با سرویس انبار برقرار نشد. صفحه را دوباره بارگذاری کنید.
        </Alert>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      <Card
        title="انبار فعال برای مشاهده"
        description="تمام آمار و اصلاحات روی انبار انتخاب‌شده اعمال می‌شوند."
        action={canWrite ? <WarehouseSheet triggerLabel="افزودن انبار" /> : null}
      >
        {warehouses.length ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <Select
                value={selectedWarehouseId ?? undefined}
                onValueChange={(value) =>
                  router.push(`/inventory?warehouse=${encodeURIComponent(value)}`)
                }
                aria-label="انتخاب انبار"
                options={warehouses.map((warehouse) => ({
                  value: warehouse.id,
                  label: `${warehouse.name}${warehouse.isDefault ? ' — پیش‌فرض' : ''}${warehouse.isActive ? '' : ' — غیرفعال'}`,
                }))}
              />
            </div>
            {selectedWarehouse ? (
              <div className="flex items-center gap-2">
                <Badge tone={selectedWarehouse.isActive ? 'success' : 'neutral'} dot>
                  {selectedWarehouse.isActive ? 'فعال' : 'غیرفعال'}
                </Badge>
                <span className="text-xs text-[var(--admin-color-muted)]">
                  کد {toPersianDigits(selectedWarehouse.code)}
                </span>
                {canWrite ? (
                  <WarehouseSheet warehouse={selectedWarehouse} triggerLabel="ویرایش" />
                ) : null}
              </div>
            ) : null}
          </div>
        ) : (
          <Alert tone="warning" title="هنوز انباری ثبت نشده است">
            {canWrite
              ? 'برای شروع مدیریت موجودی، اولین انبار را بسازید.'
              : 'برای ایجاد انبار با مدیر سیستم هماهنگ کنید.'}
          </Alert>
        )}
      </Card>

      {selectedWarehouse ? (
        <>
          {!selectedWarehouse.isActive ? (
            <Alert tone="warning" title="انبار غیرفعال است">
              اطلاعات قابل مشاهده است اما تا فعال‌سازی دوباره، اصلاح موجودی انجام نمی‌شود.
            </Alert>
          ) : null}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {[
              ['تنوع‌ها', items.length, 'neutral'],
              ['موجودی واقعی', items.reduce((sum, item) => sum + item.onHand, 0), 'info'],
              ['رزروشده', items.reduce((sum, item) => sum + item.reserved, 0), 'warning'],
              ['قابل فروش', items.reduce((sum, item) => sum + item.available, 0), 'success'],
              ['نیازمند توجه', items.filter((item) => item.isLowStock).length, 'danger'],
            ].map(([label, value, tone]) => (
              <Card
                key={String(label)}
                className={tone === 'danger' && Number(value) > 0 ? 'border-red-200' : undefined}
              >
                <p className="text-xs text-[var(--admin-color-muted)]">{label}</p>
                <p className="mt-2 text-2xl font-black">{formatAdminInteger(Number(value))}</p>
              </Card>
            ))}
          </div>

          <FilterBar
            activeCount={activeFilterCount}
            resetAction={
              activeFilterCount ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setQuery('');
                    setStatus('all');
                  }}
                >
                  پاک‌کردن فیلترها
                </Button>
              ) : undefined
            }
          >
            <SearchField
              value={query}
              onChange={(event) => setQuery(toPersianDigits(event.target.value))}
              placeholder="جستجو در محصول، تنوع یا SKU"
              aria-label="جستجوی موجودی"
            />
            <Select
              value={status}
              onValueChange={setStatus}
              aria-label="فیلتر وضعیت موجودی"
              options={[
                { value: 'all', label: 'همه وضعیت‌ها' },
                { value: 'out', label: 'ناموجود' },
                { value: 'low', label: 'کم‌موجود' },
                { value: 'reserved', label: 'دارای رزرو' },
                { value: 'healthy', label: 'موجودی مناسب' },
              ]}
            />
          </FilterBar>

          <ResponsiveDataView
            mobileLabel="کارت‌های موجودی"
            renderMobileCard={(item) => (
              <StockMobileCard item={item} canWrite={canWrite && selectedWarehouse.isActive} />
            )}
            caption={`موجودی ${selectedWarehouse.name}`}
            columns={columns}
            rows={filtered}
            getRowKey={(item) => item.variantId}
            error={
              itemsFailed
                ? { description: 'دریافت موجودی این انبار از سرور ناموفق بود.' }
                : undefined
            }
            emptyTitle="موردی پیدا نشد"
            emptyDescription="فیلترها را تغییر دهید یا ابتدا برای محصولات تنوع تعریف کنید."
            compact
          />
        </>
      ) : null}
    </div>
  );
}
