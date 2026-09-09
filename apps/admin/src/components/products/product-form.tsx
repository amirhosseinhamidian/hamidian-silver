'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, type InputEvent, useState } from 'react';

import { Alert } from '@/components/ui/alert';
import {
  createSeoEditorValue,
  isValidSeoCanonicalPath,
  SeoEditor,
  seoEditorPayload,
} from '@/components/seo/seo-editor';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input, Textarea } from '@/components/ui/form-control';
import { FormField } from '@/components/ui/form-field';
import { Select } from '@/components/ui/select';
import type { ProductFormData } from '@/lib/catalog/catalog-data';
import type { ProductSizeMode, ProductStatus } from '@/lib/catalog/catalog-model';
import { toAsciiDigits, toPersianDigits } from '@/lib/presentation/formatters';

type ProductFormProps = Readonly<{
  data: ProductFormData;
  mode: 'create' | 'edit';
}>;

function optionalText(formData: FormData, name: string): string | undefined {
  const value = String(formData.get(name) ?? '').trim();
  return value || undefined;
}

function optionalNumber(formData: FormData, name: string): number | undefined {
  const value = toAsciiDigits(String(formData.get(name) ?? ''))
    .replace(/[٬,\s]/g, '')
    .replace('٫', '.');
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function localizeNumberInput(event: InputEvent<HTMLInputElement>) {
  event.currentTarget.value = toPersianDigits(toAsciiDigits(event.currentTarget.value));
}

function apiError(payload: unknown): string {
  if (typeof payload === 'object' && payload !== null) {
    const value = payload as Record<string, unknown>;
    if (typeof value.message === 'string') return value.message;
    if (Array.isArray(value.message)) return value.message.join('، ');
    const nested = value.error as Record<string, unknown> | undefined;
    if (typeof nested?.message === 'string') return nested.message;
  }
  return 'ذخیره محصول انجام نشد. اطلاعات را بررسی و دوباره تلاش کنید.';
}

export function ProductForm({ data, mode }: ProductFormProps) {
  const router = useRouter();
  const product = data.product;
  const [sizeMode, setSizeMode] = useState<ProductSizeMode>(product?.sizeMode ?? 'NONE');
  const [seo, setSeo] = useState(() => createSeoEditorValue(product));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const name = String(formData.get('name') ?? '').trim();
    const slug = String(formData.get('slug') ?? '').trim();
    const salePriceToman = optionalNumber(formData, 'salePriceToman');
    const compareAtPriceToman = optionalNumber(formData, 'compareAtPriceToman');

    if (!name || !slug) {
      setError('نام و اسلاگ محصول الزامی هستند.');
      return;
    }
    if (Number.isNaN(salePriceToman) || Number.isNaN(compareAtPriceToman)) {
      setError('قیمت‌ها باید فقط شامل عدد باشند.');
      return;
    }
    if (
      salePriceToman !== undefined &&
      compareAtPriceToman !== undefined &&
      compareAtPriceToman <= salePriceToman
    ) {
      setError('قیمت قبل از تخفیف باید بیشتر از قیمت فروش باشد.');
      return;
    }
    if (!isValidSeoCanonicalPath(seo.canonicalPath.trim())) {
      setError('مسیر canonical باید یک مسیر داخلی بدون دامنه، query یا fragment باشد.');
      return;
    }

    const brandId = String(formData.get('brandId') ?? 'none');
    const countryId = String(formData.get('countryId') ?? 'none');
    const payload: Record<string, unknown> = {
      name,
      slug,
      shortDescription: optionalText(formData, 'shortDescription') ?? null,
      description: optionalText(formData, 'description') ?? null,
      brandId: brandId === 'none' ? null : brandId,
      countryId: countryId === 'none' ? null : countryId,
      salePriceToman: salePriceToman ?? null,
      compareAtPriceToman: compareAtPriceToman ?? null,
      categoryIds: formData.getAll('categoryIds').map(String),
      ...seoEditorPayload(seo),
    };

    if (mode === 'create') {
      const sku = String(formData.get('sku') ?? '').trim();
      const weightGrams = optionalNumber(formData, 'weightGrams');
      const sizeId = String(formData.get('sizeId') ?? 'none');
      if (!sku) {
        setError('برای ساخت محصول حداقل یک SKU الزامی است.');
        return;
      }
      if (Number.isNaN(weightGrams)) {
        setError('وزن محصول باید فقط شامل عدد باشد.');
        return;
      }
      if (sizeMode === 'SIZED' && sizeId === 'none') {
        setError('برای محصول سایزبندی‌شده، سایز تنوع اولیه را انتخاب کنید.');
        return;
      }

      payload.status = String(formData.get('status') ?? 'DRAFT') as ProductStatus;
      payload.sizeMode = sizeMode;
      payload.variants = [
        {
          sku,
          name: optionalText(formData, 'variantName'),
          weightGrams,
          ...(sizeMode === 'SIZED' ? { sizeId } : {}),
          isActive: true,
        },
      ];
      delete payload.brandId;
      delete payload.countryId;
      delete payload.salePriceToman;
      delete payload.compareAtPriceToman;
      if (brandId !== 'none') payload.brandId = brandId;
      if (countryId !== 'none') payload.countryId = countryId;
      if (salePriceToman !== undefined) payload.salePriceToman = salePriceToman;
      if (compareAtPriceToman !== undefined) payload.compareAtPriceToman = compareAtPriceToman;
      if (payload.shortDescription === null) delete payload.shortDescription;
      if (payload.description === null) delete payload.description;
    }

    setPending(true);
    setError(null);
    try {
      const endpoint =
        mode === 'create' ? '/api/catalog/products' : `/api/catalog/products/${product?.id}`;
      const response = await fetch(endpoint, {
        method: mode === 'create' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const responsePayload = (await response.json().catch(() => null)) as unknown;
      if (!response.ok) throw new Error(apiError(responsePayload));
      router.push('/products');
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : apiError(null));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="mt-6 space-y-4">
      {error ? (
        <Alert tone="danger" title="ذخیره محصول ناموفق بود">
          {error}
        </Alert>
      ) : null}

      <Card title="اطلاعات اصلی" description="نام، آدرس و توضیحاتی که در کاتالوگ استفاده می‌شوند">
        <div className="grid gap-4 md:grid-cols-2">
          <FormField id="product-name" label="نام محصول" required>
            {(props) => (
              <Input
                {...props}
                name="name"
                defaultValue={product?.name}
                placeholder="مثلاً انگشتر نقره نگین‌دار"
                required
              />
            )}
          </FormField>
          <FormField
            id="product-slug"
            label="اسلاگ محصول"
            hint="برای آدرس صفحه محصول؛ یکتا و بدون فاصله"
            required
          >
            {(props) => (
              <Input
                {...props}
                name="slug"
                defaultValue={product?.slug}
                placeholder="silver-stone-ring"
                dir="ltr"
                required
              />
            )}
          </FormField>
          <FormField id="product-short-description" label="توضیح کوتاه" className="md:col-span-2">
            {(props) => (
              <Input
                {...props}
                name="shortDescription"
                defaultValue={product?.shortDescription ?? ''}
                placeholder="یک توضیح کوتاه برای کارت محصول"
              />
            )}
          </FormField>
          <FormField id="product-description" label="توضیحات کامل" className="md:col-span-2">
            {(props) => (
              <Textarea
                {...props}
                name="description"
                defaultValue={product?.description ?? ''}
                placeholder="ویژگی‌ها، جنس، نحوه نگهداری و اطلاعات تکمیلی محصول"
              />
            )}
          </FormField>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="قیمت‌گذاری" description="مبالغ به تومان ثبت می‌شوند">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="product-sale-price" label="قیمت فروش">
              {(props) => (
                <Input
                  {...props}
                  name="salePriceToman"
                  defaultValue={
                    product?.salePriceToman === null || product?.salePriceToman === undefined
                      ? ''
                      : toPersianDigits(product.salePriceToman)
                  }
                  placeholder="مثلاً ۴٬۵۰۰٬۰۰۰"
                  inputMode="numeric"
                  onInput={localizeNumberInput}
                />
              )}
            </FormField>
            <FormField id="product-compare-price" label="قیمت قبل از تخفیف">
              {(props) => (
                <Input
                  {...props}
                  name="compareAtPriceToman"
                  defaultValue={
                    product?.compareAtPriceToman === null ||
                    product?.compareAtPriceToman === undefined
                      ? ''
                      : toPersianDigits(product.compareAtPriceToman)
                  }
                  placeholder="مثلاً ۵٬۲۰۰٬۰۰۰"
                  inputMode="numeric"
                  onInput={localizeNumberInput}
                />
              )}
            </FormField>
          </div>
        </Card>

        <Card title="طبقه‌بندی" description="برند و کشور سازنده محصول">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="product-brand" label="برند">
              {(props) => (
                <Select
                  {...props}
                  name="brandId"
                  defaultValue={product?.brand?.id ?? 'none'}
                  options={[
                    { value: 'none', label: 'بدون برند' },
                    ...data.brands.map((item) => ({ value: item.id, label: item.name })),
                  ]}
                />
              )}
            </FormField>
            <FormField id="product-country" label="کشور سازنده">
              {(props) => (
                <Select
                  {...props}
                  name="countryId"
                  defaultValue={product?.country?.id ?? 'none'}
                  options={[
                    { value: 'none', label: 'بدون کشور' },
                    ...data.countries.map((item) => ({ value: item.id, label: item.name })),
                  ]}
                />
              )}
            </FormField>
          </div>
        </Card>
      </div>

      <Card title="دسته‌بندی‌ها" description="محصول می‌تواند در چند دسته نمایش داده شود">
        {data.categories.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.categories.map((category) => (
              <Checkbox
                key={category.id}
                id={`category-${category.id}`}
                name="categoryIds"
                value={category.id}
                label={category.name}
                defaultChecked={product?.categories.some(({ id }) => id === category.id)}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--admin-color-muted)]">
            هنوز دسته‌بندی فعالی ثبت نشده است.
          </p>
        )}
      </Card>

      <SeoEditor
        value={seo}
        onChange={setSeo}
        canonicalPlaceholder={`/products/${product?.slug ?? 'product-slug'}`}
        defaultTitle={product?.name ?? 'نام محصول'}
        uploadUrl="/api/catalog/media"
        idPrefix="product-seo"
        disabled={pending}
      />

      {mode === 'create' ? (
        <Card
          title="تنوع اولیه"
          description="مدیریت کامل تنوع‌ها و سایزها در مرحله تخصصی خود تکمیل می‌شود"
        >
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <FormField id="product-status" label="وضعیت اولیه" required>
              {(props) => (
                <Select
                  {...props}
                  name="status"
                  defaultValue="DRAFT"
                  required
                  options={[
                    { value: 'DRAFT', label: 'پیش‌نویس' },
                    { value: 'ACTIVE', label: 'منتشرشده' },
                  ]}
                />
              )}
            </FormField>
            <FormField id="product-size-mode" label="حالت سایز" required>
              {(props) => (
                <Select
                  {...props}
                  name="sizeMode"
                  value={sizeMode}
                  onValueChange={(value) => setSizeMode(value as ProductSizeMode)}
                  required
                  options={[
                    { value: 'NONE', label: 'بدون سایز' },
                    { value: 'FREE_SIZE', label: 'فری‌سایز' },
                    { value: 'SIZED', label: 'سایزبندی‌شده' },
                  ]}
                />
              )}
            </FormField>
            {sizeMode === 'SIZED' ? (
              <FormField id="product-initial-size" label="سایز تنوع اولیه" required>
                {(props) => (
                  <Select
                    {...props}
                    name="sizeId"
                    defaultValue="none"
                    required
                    options={[
                      { value: 'none', label: 'انتخاب سایز' },
                      ...data.sizes
                        .filter((size) => size.active)
                        .map((size) => ({ value: size.id, label: size.label })),
                    ]}
                  />
                )}
              </FormField>
            ) : null}
            <FormField id="product-sku" label="SKU اولیه" required>
              {(props) => <Input {...props} name="sku" placeholder="RING-۰۰۱" dir="ltr" required />}
            </FormField>
            <FormField id="product-variant-name" label="نام تنوع">
              {(props) => <Input {...props} name="variantName" placeholder="مثلاً سایز ۵۲" />}
            </FormField>
            <FormField id="product-weight" label="وزن به گرم">
              {(props) => (
                <Input
                  {...props}
                  name="weightGrams"
                  placeholder="مثلاً ۴٫۲۵"
                  inputMode="decimal"
                  onInput={localizeNumberInput}
                />
              )}
            </FormField>
          </div>
        </Card>
      ) : (
        <Alert tone="info" title="تنوع‌ها از بخش عملیاتی بالای صفحه مدیریت می‌شوند">
          این محصول {toPersianDigits(product?.variants.length ?? 0)} تنوع دارد. برای تغییر SKU،
          سایز، وزن یا وضعیت از بخش «تنوع‌ها و SKU» استفاده کنید.
        </Alert>
      )}

      <div className="sticky bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-20 flex gap-2 rounded-[var(--admin-radius-lg)] border border-[var(--admin-color-border)] bg-white/95 p-3 shadow-[var(--admin-shadow-md)] backdrop-blur md:static md:justify-end md:border-0 md:bg-transparent md:p-0 md:shadow-none">
        <ButtonLink href="/products" variant="outline" className="flex-1 md:flex-none">
          انصراف
        </ButtonLink>
        <Button type="submit" loading={pending} className="flex-1 md:flex-none">
          {mode === 'create' ? 'ساخت محصول' : 'ذخیره تغییرات'}
        </Button>
      </div>
    </form>
  );
}
