'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, type InputEvent, useId, useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { BottomSheet, BottomSheetContent, BottomSheetTrigger } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import type { DataTableColumn } from '@/components/ui/data-table';
import { Input } from '@/components/ui/form-control';
import { FormField } from '@/components/ui/form-field';
import { MoneyInput } from '@/components/ui/money-input';
import { MobileDataCard } from '@/components/ui/mobile-data-card';
import { ResponsiveDataView } from '@/components/ui/responsive-data-view';
import { Select } from '@/components/ui/select';
import type {
  AdminProduct,
  AdminProductVariant,
  CatalogSize,
  CatalogSizeGroup,
} from '@/lib/catalog/catalog-model';
import {
  formatAdminInteger,
  formatAdminToman,
  toAsciiDigits,
  toPersianDigits,
} from '@/lib/presentation/formatters';

type ProductVariantManagerProps = Readonly<{
  product: AdminProduct;
  sizes: readonly CatalogSize[];
}>;

function apiError(payload: unknown): string {
  const translations: Record<string, string> = {
    'A published product must keep at least one active variant.':
      'محصول منتشرشده باید حداقل یک تنوع فعال داشته باشد.',
    'A size used by active variants cannot be deactivated.':
      'سایزی که در تنوع فعال استفاده شده قابل غیرفعال‌سازی نیست.',
    'A size with this code already exists.': 'سایزی با این کد از قبل ثبت شده است.',
    'SKU or product size is already assigned to another variant.':
      'این SKU یا سایز قبلاً به تنوع دیگری از محصول اختصاص داده شده است.',
    'Size was not found or is inactive.': 'سایز انتخاب‌شده پیدا نشد یا غیرفعال است.',
    'Product variant was not found.': 'تنوع محصول پیدا نشد.',
    'Product was not found.': 'محصول پیدا نشد.',
  };
  if (typeof payload === 'object' && payload !== null) {
    const value = payload as Record<string, unknown>;
    if (typeof value.message === 'string') return translations[value.message] ?? value.message;
    if (Array.isArray(value.message)) return value.message.join('، ');
    const nested = value.error as Record<string, unknown> | undefined;
    if (typeof nested?.message === 'string') return translations[nested.message] ?? nested.message;
  }
  return 'عملیات انجام نشد. اطلاعات را بررسی و دوباره تلاش کنید.';
}

function optionalNumber(formData: FormData, name: string): number | null | undefined {
  const normalized = toAsciiDigits(String(formData.get(name) ?? ''))
    .replace(/[٬,\s]/g, '')
    .replace('٫', '.');
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function localizeNumberInput(event: InputEvent<HTMLInputElement>) {
  event.currentTarget.value = toPersianDigits(toAsciiDigits(event.currentTarget.value));
}

function formatWeight(value: number | null): string {
  if (value === null) return 'ثبت نشده';
  return `${toPersianDigits(value.toLocaleString('en-US', { maximumFractionDigits: 3 }))} گرم`;
}

function statusBadge(active: boolean) {
  return (
    <Badge tone={active ? 'success' : 'neutral'} dot>
      {active ? 'فعال' : 'غیرفعال'}
    </Badge>
  );
}

type VariantFormProps = Readonly<{
  formId: string;
  product: AdminProduct;
  sizes: readonly CatalogSize[];
  variant?: AdminProductVariant;
  onSaved: () => void;
  onPendingChange: (pending: boolean) => void;
}>;

function VariantForm({
  formId,
  product,
  sizes,
  variant,
  onSaved,
  onPendingChange,
}: VariantFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const sku = String(formData.get('sku') ?? '').trim();
    const name = String(formData.get('name') ?? '').trim();
    const selectedSizeId = String(formData.get('sizeId') ?? 'none');
    const weightGrams = optionalNumber(formData, 'weightGrams');
    const salePriceToman = optionalNumber(formData, 'salePriceToman');
    const compareAtPriceToman = optionalNumber(formData, 'compareAtPriceToman');

    if (!sku) return setError('SKU الزامی است.');
    if (weightGrams === undefined || (weightGrams !== null && weightGrams < 0)) {
      return setError('وزن باید یک عدد مثبت با حداکثر سه رقم اعشار باشد.');
    }
    if (product.sizeMode === 'SIZED' && selectedSizeId === 'none') {
      return setError('برای این محصول انتخاب سایز الزامی است.');
    }
    if (salePriceToman === undefined || compareAtPriceToman === undefined) {
      return setError('قیمت‌ها باید فقط شامل عدد باشند.');
    }
    const effectiveSalePrice = salePriceToman ?? product.salePriceToman;
    const effectiveComparePrice = compareAtPriceToman ?? product.compareAtPriceToman;
    if (effectiveSalePrice === null) {
      return setError('قیمت فروش مستقل تنوع یا قیمت پیش‌فرض محصول الزامی است.');
    }
    if (effectiveComparePrice !== null && effectiveComparePrice <= effectiveSalePrice) {
      return setError('قیمت قبل از تخفیف تنوع باید بیشتر از قیمت فروش آن باشد.');
    }

    const payload: Record<string, unknown> = {
      sku,
      isActive: formData.get('isActive') === 'on',
      ...(product.sizeMode === 'SIZED'
        ? { sizeId: selectedSizeId }
        : variant
          ? { sizeId: null }
          : {}),
    };
    if (name) payload.name = name;
    else if (variant) payload.name = null;
    if (weightGrams !== null) payload.weightGrams = weightGrams;
    else if (variant) payload.weightGrams = null;
    if (salePriceToman !== null) payload.salePriceToman = salePriceToman;
    else if (variant) payload.salePriceToman = null;
    if (compareAtPriceToman !== null) payload.compareAtPriceToman = compareAtPriceToman;
    else if (variant) payload.compareAtPriceToman = null;
    const endpoint = variant
      ? `/api/catalog/products/${product.id}/variants/${variant.id}`
      : `/api/catalog/products/${product.id}/variants`;

    setError(null);
    onPendingChange(true);
    try {
      const response = await fetch(endpoint, {
        method: variant ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const responsePayload = (await response.json().catch(() => null)) as unknown;
      if (!response.ok) throw new Error(apiError(responsePayload));
      onSaved();
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : apiError(null));
    } finally {
      onPendingChange(false);
    }
  }

  const sizeOptions = sizes
    .filter(
      (size) =>
        size.groupId === product.sizeGroup?.id && (size.active || size.id === variant?.size?.id),
    )
    .map((size) => ({
      value: size.id,
      label: `${size.label} — ${toPersianDigits(size.code)}`,
      disabled: !size.active,
    }));

  return (
    <form id={formId} onSubmit={(event) => void submit(event)} className="space-y-4">
      {error ? (
        <Alert tone="danger" title="ذخیره تنوع ناموفق بود">
          {error}
        </Alert>
      ) : null}

      <FormField id={`${formId}-sku`} label="SKU" required>
        {(props) => (
          <Input
            {...props}
            name="sku"
            defaultValue={variant?.sku}
            placeholder="مثلاً RING-052"
            dir="ltr"
            maxLength={100}
            required
          />
        )}
      </FormField>
      <FormField id={`${formId}-name`} label="نام تنوع">
        {(props) => (
          <Input
            {...props}
            name="name"
            defaultValue={variant?.name ?? ''}
            placeholder="مثلاً انگشتر سایز ۵۲"
            maxLength={150}
          />
        )}
      </FormField>
      {product.sizeMode === 'SIZED' ? (
        <FormField id={`${formId}-size`} label="سایز" required>
          {(props) => (
            <Select
              {...props}
              name="sizeId"
              defaultValue={variant?.size?.id ?? 'none'}
              options={[{ value: 'none', label: 'انتخاب سایز' }, ...sizeOptions]}
              required
            />
          )}
        </FormField>
      ) : (
        <Alert tone="info">
          حالت سایز این محصول «{product.sizeMode === 'FREE_SIZE' ? 'فری‌سایز' : 'بدون سایز'}» است.
        </Alert>
      )}
      <FormField id={`${formId}-weight`} label="وزن به گرم" hint="حداکثر سه رقم اعشار">
        {(props) => (
          <Input
            {...props}
            name="weightGrams"
            defaultValue={
              variant?.weightGrams === null || variant?.weightGrams === undefined
                ? ''
                : toPersianDigits(variant.weightGrams)
            }
            placeholder="مثلاً ۴٫۲۵۰"
            inputMode="decimal"
            onInput={localizeNumberInput}
          />
        )}
      </FormField>
      <FormField
        id={`${formId}-sale-price`}
        label="قیمت فروش این تنوع"
        hint="در صورت خالی‌بودن، قیمت پیش‌فرض محصول استفاده می‌شود."
      >
        {(props) => (
          <MoneyInput
            {...props}
            name="salePriceToman"
            defaultValue={
              variant?.salePriceToman === null || variant?.salePriceToman === undefined
                ? ''
                : toPersianDigits(variant.salePriceToman)
            }
            placeholder="مثلاً ۴٬۷۰۰٬۰۰۰"
          />
        )}
      </FormField>
      <FormField id={`${formId}-compare-price`} label="قیمت قبل از تخفیف این تنوع">
        {(props) => (
          <MoneyInput
            {...props}
            name="compareAtPriceToman"
            defaultValue={
              variant?.compareAtPriceToman === null || variant?.compareAtPriceToman === undefined
                ? ''
                : toPersianDigits(variant.compareAtPriceToman)
            }
            placeholder="مثلاً ۵٬۲۰۰٬۰۰۰"
          />
        )}
      </FormField>
      <Checkbox
        id={`${formId}-active`}
        name="isActive"
        label="تنوع فعال باشد"
        description="تنوع غیرفعال برای خرید و عملیات جدید در دسترس نیست."
        defaultChecked={variant?.active ?? true}
      />
    </form>
  );
}

function VariantSheet({
  product,
  sizes,
  variant,
  triggerLabel,
  triggerVariant = 'outline',
}: Readonly<{
  product: AdminProduct;
  sizes: readonly CatalogSize[];
  variant?: AdminProductVariant;
  triggerLabel: string;
  triggerVariant?: 'primary' | 'outline' | 'ghost';
}>) {
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  return (
    <BottomSheet open={open} onOpenChange={setOpen}>
      <BottomSheetTrigger asChild>
        <Button
          variant={triggerVariant}
          size="sm"
          disabled={!variant && product.sizeMode === 'SIZED' && !sizes.some((size) => size.active)}
        >
          {triggerLabel}
        </Button>
      </BottomSheetTrigger>
      <BottomSheetContent
        title={variant ? `ویرایش ${toPersianDigits(variant.sku)}` : 'افزودن تنوع جدید'}
        description="SKU، سایز، وزن و وضعیت دسترسی این تنوع را مدیریت کنید."
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              انصراف
            </Button>
            <Button type="submit" form={formId} loading={pending}>
              {variant ? 'ذخیره تغییرات' : 'افزودن تنوع'}
            </Button>
          </>
        }
      >
        <VariantForm
          formId={formId}
          product={product}
          sizes={sizes}
          variant={variant}
          onSaved={() => setOpen(false)}
          onPendingChange={setPending}
        />
      </BottomSheetContent>
    </BottomSheet>
  );
}

function VariantMobileCard({
  product,
  sizes,
  variant,
}: Readonly<{
  product: AdminProduct;
  sizes: readonly CatalogSize[];
  variant: AdminProductVariant;
}>) {
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  return (
    <MobileDataCard
      eyebrow={`SKU: ${toPersianDigits(variant.sku)}`}
      title={variant.name ?? variant.size?.label ?? 'تنوع بدون نام'}
      status={statusBadge(variant.active)}
      items={[
        { label: 'سایز', value: variant.size?.label ?? 'ندارد' },
        { label: 'وزن', value: formatWeight(variant.weightGrams) },
        {
          label: 'قیمت فروش',
          value: formatAdminToman(variant.salePriceToman ?? product.salePriceToman ?? 0),
        },
      ]}
      detailsTitle={`تنوع ${toPersianDigits(variant.sku)}`}
      detailsDescription="جزئیات کامل و امکان ویرایش سریع"
      detailsOpen={open}
      onDetailsOpenChange={setOpen}
      details={
        <VariantForm
          formId={formId}
          product={product}
          sizes={sizes}
          variant={variant}
          onSaved={() => setOpen(false)}
          onPendingChange={setPending}
        />
      }
      detailsFooter={
        <Button type="submit" form={formId} loading={pending}>
          ذخیره تغییرات
        </Button>
      }
    />
  );
}

type SizeFormProps = Readonly<{
  formId: string;
  sizeGroups: readonly CatalogSizeGroup[];
  size?: CatalogSize;
  onSaved: () => void;
  onPendingChange: (pending: boolean) => void;
}>;

function SizeForm({ formId, sizeGroups, size, onSaved, onPendingChange }: SizeFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const activeGroups = sizeGroups.filter((group) => group.active);
  const defaultGroupId =
    size?.groupId ?? (activeGroups.length === 1 ? activeGroups[0]?.id : undefined) ?? 'none';

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const code = String(formData.get('code') ?? '').trim();
    const label = String(formData.get('label') ?? '').trim();
    const groupId = String(formData.get('groupId') ?? 'none');
    const sortOrder = optionalNumber(formData, 'sortOrder');
    if (!code || !label || groupId === 'none') {
      return setError('گروه، کد و عنوان نمایشی سایز الزامی هستند.');
    }
    if (
      sortOrder === undefined ||
      sortOrder === null ||
      !Number.isInteger(sortOrder) ||
      sortOrder < 0
    ) {
      return setError('ترتیب نمایش باید یک عدد صحیح صفر یا بزرگ‌تر باشد.');
    }

    setError(null);
    onPendingChange(true);
    try {
      const response = await fetch(size ? `/api/catalog/sizes/${size.id}` : '/api/catalog/sizes', {
        method: size ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId,
          code,
          label,
          sortOrder,
          isActive: formData.get('isActive') === 'on',
        }),
      });
      const responsePayload = (await response.json().catch(() => null)) as unknown;
      if (!response.ok) throw new Error(apiError(responsePayload));
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
        <Alert tone="danger" title="ذخیره سایز ناموفق بود">
          {error}
        </Alert>
      ) : null}
      <FormField id={`${formId}-group`} label="گروه سایزبندی" required>
        {(props) => (
          <Select
            {...props}
            name="groupId"
            defaultValue={defaultGroupId}
            options={[
              { value: 'none', label: 'انتخاب گروه' },
              ...sizeGroups
                .filter((group) => group.active || group.id === size?.groupId)
                .map((group) => ({ value: group.id, label: group.name })),
            ]}
          />
        )}
      </FormField>
      <FormField id={`${formId}-code`} label="کد سایز" required>
        {(props) => (
          <Input
            {...props}
            name="code"
            defaultValue={size?.code}
            placeholder="مثلاً 52 یا XL"
            dir="ltr"
            maxLength={50}
            required
          />
        )}
      </FormField>
      <FormField id={`${formId}-label`} label="عنوان نمایشی" required>
        {(props) => (
          <Input
            {...props}
            name="label"
            defaultValue={size?.label}
            placeholder="مثلاً سایز ۵۲"
            maxLength={100}
            required
          />
        )}
      </FormField>
      <FormField id={`${formId}-order`} label="ترتیب نمایش" required>
        {(props) => (
          <Input
            {...props}
            name="sortOrder"
            defaultValue={toPersianDigits(size?.sortOrder ?? 0)}
            inputMode="numeric"
            onInput={localizeNumberInput}
            required
          />
        )}
      </FormField>
      <Checkbox
        id={`${formId}-active`}
        name="isActive"
        label="سایز فعال باشد"
        description="سایز غیرفعال هنگام افزودن تنوع جدید قابل انتخاب نیست."
        defaultChecked={size?.active ?? true}
      />
    </form>
  );
}

function SizeSheet({
  sizeGroups,
  size,
}: Readonly<{ sizeGroups: readonly CatalogSizeGroup[]; size?: CatalogSize }>) {
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  return (
    <BottomSheet open={open} onOpenChange={setOpen}>
      <BottomSheetTrigger asChild>
        <Button variant={size ? 'ghost' : 'outline'} size="sm">
          {size ? 'ویرایش' : 'افزودن سایز'}
        </Button>
      </BottomSheetTrigger>
      <BottomSheetContent
        title={size ? `ویرایش ${size.label}` : 'افزودن سایز جدید'}
        description="سایزها در تمام محصولات سایزبندی‌شده قابل استفاده هستند."
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              انصراف
            </Button>
            <Button type="submit" form={formId} loading={pending}>
              ذخیره سایز
            </Button>
          </>
        }
      >
        <SizeForm
          formId={formId}
          sizeGroups={sizeGroups}
          size={size}
          onSaved={() => setOpen(false)}
          onPendingChange={setPending}
        />
      </BottomSheetContent>
    </BottomSheet>
  );
}

function SizeMobileCard({
  sizeGroups,
  size,
  canWrite,
}: Readonly<{
  sizeGroups: readonly CatalogSizeGroup[];
  size: CatalogSize;
  canWrite: boolean;
}>) {
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  return (
    <MobileDataCard
      eyebrow={`کد ${toPersianDigits(size.code)}`}
      title={size.label}
      status={statusBadge(size.active)}
      items={[
        { label: 'گروه', value: size.group.name },
        { label: 'ترتیب نمایش', value: formatAdminInteger(size.sortOrder) },
      ]}
      detailsTitle={`سایز ${size.label}`}
      detailsDescription="جزئیات کامل و امکان ویرایش سریع"
      detailsLabel={canWrite ? 'مشاهده جزئیات و عملیات' : 'مشاهده جزئیات'}
      detailsOpen={open}
      onDetailsOpenChange={setOpen}
      details={
        canWrite ? (
          <SizeForm
            formId={formId}
            sizeGroups={sizeGroups}
            size={size}
            onSaved={() => setOpen(false)}
            onPendingChange={setPending}
          />
        ) : (
          <Alert tone="neutral">برای ویرایش سایز به مجوز مدیریت کاتالوگ نیاز دارید.</Alert>
        )
      }
      detailsFooter={
        canWrite ? (
          <Button type="submit" form={formId} loading={pending}>
            ذخیره تغییرات
          </Button>
        ) : undefined
      }
    />
  );
}

export function ProductVariantManager({ product, sizes }: ProductVariantManagerProps) {
  const variantColumns: readonly DataTableColumn<AdminProductVariant>[] = [
    {
      id: 'sku',
      header: 'SKU',
      cell: (variant) => <span dir="ltr">{toPersianDigits(variant.sku)}</span>,
    },
    { id: 'name', header: 'نام تنوع', cell: (variant) => variant.name ?? '—' },
    { id: 'size', header: 'سایز', cell: (variant) => variant.size?.label ?? '—' },
    { id: 'weight', header: 'وزن', cell: (variant) => formatWeight(variant.weightGrams) },
    {
      id: 'price',
      header: 'قیمت فروش',
      cell: (variant) => formatAdminToman(variant.salePriceToman ?? product.salePriceToman ?? 0),
    },
    { id: 'status', header: 'وضعیت', cell: (variant) => statusBadge(variant.active) },
    {
      id: 'actions',
      header: 'عملیات',
      cell: (variant) => (
        <VariantSheet
          product={product}
          sizes={sizes}
          variant={variant}
          triggerLabel="ویرایش"
          triggerVariant="ghost"
        />
      ),
    },
  ];
  return (
    <div className="space-y-6">
      <Card
        title="تنوع‌ها و SKU"
        description={`${formatAdminInteger(product.variants.length)} تنوع برای این محصول ثبت شده است.`}
        action={
          <VariantSheet
            product={product}
            sizes={sizes}
            triggerLabel="افزودن تنوع"
            triggerVariant="primary"
          />
        }
      >
        {product.sizeMode === 'SIZED' && !sizes.some((size) => size.active) ? (
          <Alert tone="warning" className="mb-4">
            برای افزودن تنوع، ابتدا یک سایز فعال در بخش پایین صفحه بسازید.
          </Alert>
        ) : null}
        <ResponsiveDataView
          mobileLabel="کارت‌های تنوع محصول"
          renderMobileCard={(variant) => (
            <VariantMobileCard product={product} sizes={sizes} variant={variant} />
          )}
          caption="جدول تنوع‌های محصول"
          columns={variantColumns}
          rows={product.variants}
          getRowKey={(variant) => variant.id}
          emptyTitle="تنوعی ثبت نشده است"
          emptyDescription="برای قابل فروش شدن محصول حداقل یک تنوع فعال بسازید."
          compact
        />
      </Card>
    </div>
  );
}

type SizeGroupFormProps = Readonly<{
  formId: string;
  group?: CatalogSizeGroup;
  onSaved: () => void;
  onPendingChange: (pending: boolean) => void;
}>;

function SizeGroupForm({ formId, group, onSaved, onPendingChange }: SizeGroupFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const code = String(formData.get('code') ?? '').trim();
    const name = String(formData.get('name') ?? '').trim();
    const selectionLabel = String(formData.get('selectionLabel') ?? '').trim();
    const cartLabel = String(formData.get('cartLabel') ?? '').trim();
    const sortOrder = optionalNumber(formData, 'sortOrder');
    if (!code || !name || !selectionLabel || !cartLabel) {
      return setError('کد، نام و عنوان‌های نمایشی گروه الزامی هستند.');
    }
    if (sortOrder === undefined || sortOrder === null || !Number.isInteger(sortOrder)) {
      return setError('ترتیب نمایش باید یک عدد صحیح صفر یا بزرگ‌تر باشد.');
    }

    setError(null);
    onPendingChange(true);
    try {
      const response = await fetch(
        group ? `/api/catalog/size-groups/${group.id}` : '/api/catalog/size-groups',
        {
          method: group ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code,
            name,
            selectionLabel,
            cartLabel,
            sortOrder,
            isActive: formData.get('isActive') === 'on',
          }),
        },
      );
      const payload = (await response.json().catch(() => null)) as unknown;
      if (!response.ok) throw new Error(apiError(payload));
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
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <FormField id={`${formId}-code`} label="کد گروه" required>
        {(props) => (
          <Input
            {...props}
            name="code"
            defaultValue={group?.code}
            placeholder="مثلاً NECKLACE_LENGTH"
            dir="ltr"
            maxLength={50}
          />
        )}
      </FormField>
      <FormField id={`${formId}-name`} label="نام گروه" required>
        {(props) => (
          <Input
            {...props}
            name="name"
            defaultValue={group?.name}
            placeholder="مثلاً طول گردنبند"
            maxLength={100}
          />
        )}
      </FormField>
      <FormField id={`${formId}-selection-label`} label="عنوان انتخاب در صفحه محصول" required>
        {(props) => (
          <Input
            {...props}
            name="selectionLabel"
            defaultValue={group?.selectionLabel}
            placeholder="مثلاً انتخاب طول"
            maxLength={100}
          />
        )}
      </FormField>
      <FormField id={`${formId}-cart-label`} label="عنوان در سبد و سفارش" required>
        {(props) => (
          <Input
            {...props}
            name="cartLabel"
            defaultValue={group?.cartLabel}
            placeholder="مثلاً طول"
            maxLength={50}
          />
        )}
      </FormField>
      <FormField id={`${formId}-order`} label="ترتیب نمایش" required>
        {(props) => (
          <Input
            {...props}
            name="sortOrder"
            defaultValue={toPersianDigits(group?.sortOrder ?? 0)}
            inputMode="numeric"
            onInput={localizeNumberInput}
          />
        )}
      </FormField>
      <Checkbox
        id={`${formId}-active`}
        name="isActive"
        label="گروه فعال باشد"
        description="گروه غیرفعال برای سایزهای جدید قابل انتخاب نیست."
        defaultChecked={group?.active ?? true}
      />
    </form>
  );
}

function SizeGroupSheet({ group }: Readonly<{ group?: CatalogSizeGroup }>) {
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  return (
    <BottomSheet open={open} onOpenChange={setOpen}>
      <BottomSheetTrigger asChild>
        <Button variant={group ? 'ghost' : 'outline'} size="sm">
          {group ? 'ویرایش' : 'افزودن گروه'}
        </Button>
      </BottomSheetTrigger>
      <BottomSheetContent
        title={group ? `ویرایش ${group.name}` : 'افزودن گروه سایزبندی'}
        description="هر گروه مجموعه مقادیر مرتبط و واژگان نمایشی خودش را دارد."
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              انصراف
            </Button>
            <Button type="submit" form={formId} loading={pending}>
              ذخیره گروه
            </Button>
          </>
        }
      >
        <SizeGroupForm
          formId={formId}
          group={group}
          onSaved={() => setOpen(false)}
          onPendingChange={setPending}
        />
      </BottomSheetContent>
    </BottomSheet>
  );
}

export function CatalogSizeGroupManager({
  groups,
  canWrite = true,
}: Readonly<{ groups: readonly CatalogSizeGroup[]; canWrite?: boolean }>) {
  const columns: readonly DataTableColumn<CatalogSizeGroup>[] = [
    { id: 'name', header: 'نام گروه', cell: (group) => group.name },
    { id: 'selection', header: 'عنوان انتخاب', cell: (group) => group.selectionLabel },
    { id: 'cart', header: 'عنوان سبد', cell: (group) => group.cartLabel },
    { id: 'status', header: 'وضعیت', cell: (group) => statusBadge(group.active) },
    ...(canWrite
      ? ([
          {
            id: 'actions',
            header: 'عملیات',
            cell: (group: CatalogSizeGroup) => <SizeGroupSheet group={group} />,
          },
        ] as const)
      : []),
  ];

  return (
    <Card
      title="گروه‌های سایزبندی"
      description="گروه‌های انگشتر، طول گردنبند و طول دستبند را جداگانه مدیریت کنید."
      action={canWrite ? <SizeGroupSheet /> : undefined}
    >
      <ResponsiveDataView
        mobileLabel="کارت‌های گروه سایزبندی"
        renderMobileCard={(group) => <SizeGroupMobileCard group={group} canWrite={canWrite} />}
        caption="جدول گروه‌های سایزبندی"
        columns={columns}
        rows={groups}
        getRowKey={(group) => group.id}
        emptyTitle="گروهی ثبت نشده است"
        emptyDescription="اولین گروه سایزبندی را اضافه کنید."
        compact
      />
    </Card>
  );
}

function SizeGroupMobileCard({
  group,
  canWrite,
}: Readonly<{ group: CatalogSizeGroup; canWrite: boolean }>) {
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  return (
    <MobileDataCard
      eyebrow={group.code}
      title={group.name}
      status={statusBadge(group.active)}
      items={[
        { label: 'عنوان انتخاب', value: group.selectionLabel },
        { label: 'عنوان سبد', value: group.cartLabel },
      ]}
      detailsTitle={`گروه ${group.name}`}
      detailsDescription="جزئیات کامل و امکان ویرایش سریع"
      detailsLabel={canWrite ? 'مشاهده جزئیات و عملیات' : 'مشاهده جزئیات'}
      detailsOpen={open}
      onDetailsOpenChange={setOpen}
      details={
        canWrite ? (
          <SizeGroupForm
            formId={formId}
            group={group}
            onSaved={() => setOpen(false)}
            onPendingChange={setPending}
          />
        ) : (
          <Alert tone="neutral">برای ویرایش گروه به مجوز مدیریت کاتالوگ نیاز دارید.</Alert>
        )
      }
      detailsFooter={
        canWrite ? (
          <Button type="submit" form={formId} loading={pending}>
            ذخیره تغییرات
          </Button>
        ) : undefined
      }
    />
  );
}

export function CatalogSizeManager({
  sizes,
  sizeGroups,
  canWrite = true,
}: Readonly<{
  sizes: readonly CatalogSize[];
  sizeGroups: readonly CatalogSizeGroup[];
  canWrite?: boolean;
}>) {
  const sizeColumns: readonly DataTableColumn<CatalogSize>[] = [
    { id: 'label', header: 'عنوان', cell: (size) => size.label },
    { id: 'code', header: 'کد', cell: (size) => toPersianDigits(size.code) },
    { id: 'group', header: 'گروه', cell: (size) => size.group.name },
    { id: 'order', header: 'ترتیب', cell: (size) => formatAdminInteger(size.sortOrder) },
    { id: 'status', header: 'وضعیت', cell: (size) => statusBadge(size.active) },
    ...(canWrite
      ? ([
          {
            id: 'actions',
            header: 'عملیات',
            cell: (size: CatalogSize) => <SizeSheet sizeGroups={sizeGroups} size={size} />,
          },
        ] as const)
      : []),
  ];

  return (
    <Card
      title="سایزهای کاتالوگ"
      description="سایزهای مشترک محصولات سایزبندی‌شده را تعریف، مرتب یا غیرفعال کنید."
      action={canWrite ? <SizeSheet sizeGroups={sizeGroups} /> : undefined}
    >
      <ResponsiveDataView
        mobileLabel="کارت‌های سایز کاتالوگ"
        renderMobileCard={(size) => (
          <SizeMobileCard sizeGroups={sizeGroups} size={size} canWrite={canWrite} />
        )}
        caption="جدول سایزهای کاتالوگ"
        columns={sizeColumns}
        rows={sizes}
        getRowKey={(size) => size.id}
        emptyTitle="سایزی ثبت نشده است"
        emptyDescription="اولین سایز کاتالوگ را اضافه کنید."
        compact
      />
    </Card>
  );
}
