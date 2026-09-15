'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';

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
import { MoneyInput } from '@/components/ui/money-input';
import { Select } from '@/components/ui/select';
import type { ProductFormData } from '@/lib/catalog/catalog-data';
import type { ProductSizeMode, ProductStatus } from '@/lib/catalog/catalog-model';
import { toAsciiDigits, toPersianDigits } from '@/lib/presentation/formatters';

type ProductFormProps = Readonly<{
  data: ProductFormData;
  mode: 'create' | 'edit';
}>;

type EditableProductAttribute = Readonly<{
  id: string;
  key: string;
  value: string;
}>;

type EditableProductVariant = Readonly<{
  id: string;
  sku: string;
  name: string;
  sizeId: string;
  weightGrams: string;
}>;

function createAttributeId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `attribute-${Date.now()}-${Math.random()}`;
}

function createVariant(): EditableProductVariant {
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `variant-${Date.now()}-${Math.random()}`,
    sku: '',
    name: '',
    sizeId: 'none',
    weightGrams: '',
  };
}

function optionalText(formData: FormData, name: string): string | undefined {
  const value = String(formData.get(name) ?? '').trim();
  return value || undefined;
}

function optionalNumber(formData: FormData, name: string): number | undefined {
  return optionalNumberValue(String(formData.get(name) ?? ''));
}

function optionalNumberValue(input: string): number | undefined {
  const value = toAsciiDigits(input)
    .replace(/[٬,\s]/g, '')
    .replace('٫', '.');
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function isValidOptionalWeight(input: string): boolean {
  const normalized = toAsciiDigits(input.trim()).replace('٫', '.');
  return !normalized || /^\d+(?:\.\d{1,3})?$/.test(normalized);
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
  const [attributes, setAttributes] = useState<EditableProductAttribute[]>(() =>
    (product?.attributes ?? []).map((attribute) => ({
      id: attribute.id,
      key: attribute.key,
      value: attribute.value,
    })),
  );
  const [variants, setVariants] = useState<EditableProductVariant[]>(() => [createVariant()]);
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

    const normalizedAttributes = attributes.map((attribute, index) => ({
      key: attribute.key.trim().replace(/\s+/g, ' '),
      value: attribute.value.trim(),
      sortOrder: index + 1,
    }));
    if (normalizedAttributes.some((attribute) => !attribute.key || !attribute.value)) {
      setError('کلید و مقدار همه ویژگی‌های محصول الزامی هستند.');
      return;
    }
    if (
      normalizedAttributes.some(
        (attribute) => attribute.key.length > 100 || attribute.value.length > 500,
      )
    ) {
      setError('کلید ویژگی حداکثر ۱۰۰ و مقدار آن حداکثر ۵۰۰ نویسه می‌تواند باشد.');
      return;
    }
    const attributeKeys = normalizedAttributes.map((attribute) =>
      attribute.key.toLocaleLowerCase('fa-IR'),
    );
    if (new Set(attributeKeys).size !== attributeKeys.length) {
      setError('کلید ویژگی‌های محصول نباید تکراری باشد.');
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
      attributes: normalizedAttributes,
      ...seoEditorPayload(seo),
    };

    if (mode === 'create') {
      const normalizedVariants = variants.map((variant) => ({
        sku: variant.sku.trim(),
        name: variant.name.trim(),
        sizeId: variant.sizeId,
        weightGrams: optionalNumberValue(variant.weightGrams),
      }));
      if (normalizedVariants.some((variant) => !variant.sku)) {
        setError('SKU همه تنوع‌ها الزامی است.');
        return;
      }
      if (
        variants.some((variant) => !isValidOptionalWeight(variant.weightGrams)) ||
        normalizedVariants.some((variant) => Number.isNaN(variant.weightGrams))
      ) {
        setError('وزن تنوع‌ها باید فقط شامل عدد و حداکثر سه رقم اعشار باشد.');
        return;
      }
      const normalizedSkus = normalizedVariants.map((variant) => variant.sku.toLowerCase());
      if (new Set(normalizedSkus).size !== normalizedSkus.length) {
        setError('SKU تنوع‌ها نباید تکراری باشد.');
        return;
      }
      if (sizeMode === 'SIZED' && normalizedVariants.some((variant) => variant.sizeId === 'none')) {
        setError('برای هر تنوع محصول سایزبندی‌شده، انتخاب سایز الزامی است.');
        return;
      }
      if (sizeMode === 'SIZED') {
        const sizeIds = normalizedVariants.map((variant) => variant.sizeId);
        if (new Set(sizeIds).size !== sizeIds.length) {
          setError('هر سایز فقط می‌تواند به یک تنوع این محصول اختصاص داده شود.');
          return;
        }
      }

      if (normalizedVariants.length === 0) {
        setError('برای ساخت محصول حداقل یک تنوع الزامی است.');
        return;
      }

      payload.status = String(formData.get('status') ?? 'DRAFT') as ProductStatus;
      payload.sizeMode = sizeMode;
      payload.variants = normalizedVariants.map((variant) => ({
        sku: variant.sku,
        ...(variant.name ? { name: variant.name } : {}),
        ...(variant.weightGrams !== undefined ? { weightGrams: variant.weightGrams } : {}),
        ...(sizeMode === 'SIZED' ? { sizeId: variant.sizeId } : {}),
        isActive: true,
      }));
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
      const createdProductId =
        mode === 'create' &&
        typeof responsePayload === 'object' &&
        responsePayload !== null &&
        typeof (responsePayload as { id?: unknown }).id === 'string'
          ? (responsePayload as { id: string }).id
          : null;
      router.push(createdProductId ? `/variants/${createdProductId}` : '/products');
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
            hint={
              mode === 'edit'
                ? 'با تغییر اسلاگ، آدرس قبلی به‌صورت دائمی به آدرس جدید منتقل می‌شود.'
                : 'برای آدرس صفحه محصول؛ یکتا و بدون فاصله'
            }
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
                <MoneyInput
                  {...props}
                  name="salePriceToman"
                  defaultValue={
                    product?.salePriceToman === null || product?.salePriceToman === undefined
                      ? ''
                      : toPersianDigits(product.salePriceToman)
                  }
                  placeholder="مثلاً ۴٬۵۰۰٬۰۰۰"
                />
              )}
            </FormField>
            <FormField id="product-compare-price" label="قیمت قبل از تخفیف">
              {(props) => (
                <MoneyInput
                  {...props}
                  name="compareAtPriceToman"
                  defaultValue={
                    product?.compareAtPriceToman === null ||
                    product?.compareAtPriceToman === undefined
                      ? ''
                      : toPersianDigits(product.compareAtPriceToman)
                  }
                  placeholder="مثلاً ۵٬۲۰۰٬۰۰۰"
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

      <Card
        title="ویژگی‌های محصول"
        description="این ویژگی‌ها بعد از برند، کشور سازنده، سایزبندی و وزن نمایش داده می‌شوند"
        action={
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending || attributes.length >= 30}
            onClick={() =>
              setAttributes((current) => [
                ...current,
                { id: createAttributeId(), key: '', value: '' },
              ])
            }
          >
            افزودن ویژگی
          </Button>
        }
      >
        {attributes.length > 0 ? (
          <div className="space-y-3">
            {attributes.map((attribute, index) => (
              <div
                key={attribute.id}
                className="rounded-[var(--admin-radius-md)] border border-[var(--admin-color-border)] p-3"
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-medium text-[var(--admin-color-muted)]">
                    ترتیب نمایش: {toPersianDigits(index + 1)}
                  </span>
                  <div className="flex flex-wrap gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={pending || index === 0}
                      aria-label={`انتقال ویژگی ${toPersianDigits(index + 1)} به بالا`}
                      onClick={() =>
                        setAttributes((current) => {
                          const next = [...current];
                          const [moved] = next.splice(index, 1);
                          if (!moved) return current;
                          next.splice(index - 1, 0, moved);
                          return next;
                        })
                      }
                    >
                      بالا
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={pending || index === attributes.length - 1}
                      aria-label={`انتقال ویژگی ${toPersianDigits(index + 1)} به پایین`}
                      onClick={() =>
                        setAttributes((current) => {
                          const next = [...current];
                          const [moved] = next.splice(index, 1);
                          if (!moved) return current;
                          next.splice(index + 1, 0, moved);
                          return next;
                        })
                      }
                    >
                      پایین
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      aria-label={`حذف ویژگی ${toPersianDigits(index + 1)}`}
                      onClick={() =>
                        setAttributes((current) =>
                          current.filter((item) => item.id !== attribute.id),
                        )
                      }
                    >
                      حذف
                    </Button>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <FormField
                    id={`product-attribute-key-${attribute.id}`}
                    label={`کلید ویژگی ${toPersianDigits(index + 1)}`}
                    required
                  >
                    {(props) => (
                      <Input
                        {...props}
                        value={attribute.key}
                        maxLength={100}
                        placeholder="مثلاً جنس نگین"
                        disabled={pending}
                        onChange={(event) =>
                          setAttributes((current) =>
                            current.map((item) =>
                              item.id === attribute.id
                                ? { ...item, key: event.target.value }
                                : item,
                            ),
                          )
                        }
                      />
                    )}
                  </FormField>
                  <FormField
                    id={`product-attribute-value-${attribute.id}`}
                    label={`مقدار ویژگی ${toPersianDigits(index + 1)}`}
                    required
                  >
                    {(props) => (
                      <Input
                        {...props}
                        value={attribute.value}
                        maxLength={500}
                        placeholder="مثلاً زیرکونیا"
                        disabled={pending}
                        onChange={(event) =>
                          setAttributes((current) =>
                            current.map((item) =>
                              item.id === attribute.id
                                ? { ...item, value: event.target.value }
                                : item,
                            ),
                          )
                        }
                      />
                    )}
                  </FormField>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--admin-color-muted)]">
            هنوز ویژگی سفارشی برای این محصول ثبت نشده است.
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
          title="تنوع‌ها و سایزبندی محصول"
          description="هر ردیف یک کالای قابل فروش با SKU مستقل است؛ همه تنوع‌های فعلی محصول را همین‌جا اضافه کنید."
          action={
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => setVariants((current) => [...current, createVariant()])}
            >
              افزودن تنوع
            </Button>
          }
        >
          <div className="grid gap-4 md:grid-cols-2">
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
            <FormField
              id="product-size-mode"
              label="نوع سایزبندی محصول"
              hint="این انتخاب برای تمام تنوع‌های این محصول اعمال می‌شود."
              required
            >
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
          </div>

          <Alert tone="info" className="mt-4">
            «نام تنوع» عنوان قابل‌فهم برای مدیر و مشتری است؛ مثل «سایز ۵۲» یا «مدل طلایی». SKU شناسه
            یکتای انبار و سفارش است و برای هر ردیف باید متفاوت باشد.
          </Alert>

          {sizeMode === 'SIZED' && !data.sizes.some((size) => size.active) ? (
            <Alert tone="warning" className="mt-4">
              هنوز سایز فعالی تعریف نشده است. ابتدا از بخش «تنوع و سایزبندی» یک سایز بسازید.
            </Alert>
          ) : null}

          <div className="mt-4 space-y-4">
            {variants.map((variant, index) => {
              const number = toPersianDigits(index + 1);
              const updateVariant = (updates: Partial<EditableProductVariant>) =>
                setVariants((current) =>
                  current.map((item) => (item.id === variant.id ? { ...item, ...updates } : item)),
                );
              return (
                <section
                  key={variant.id}
                  aria-label={`تنوع ${number}`}
                  className="rounded-[var(--admin-radius-md)] border border-[var(--admin-color-border)] bg-[var(--admin-color-surface-subtle)] p-4"
                >
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h3 className="text-sm font-bold">تنوع {number}</h3>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pending || variants.length === 1}
                      onClick={() =>
                        setVariants((current) => current.filter((item) => item.id !== variant.id))
                      }
                    >
                      حذف تنوع
                    </Button>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <FormField
                      id={`product-variant-${variant.id}-sku`}
                      label={`SKU تنوع ${number}`}
                      required
                    >
                      {(props) => (
                        <Input
                          {...props}
                          value={variant.sku}
                          placeholder="مثلاً RING-052"
                          dir="ltr"
                          maxLength={100}
                          disabled={pending}
                          required
                          onChange={(event) => updateVariant({ sku: event.target.value })}
                        />
                      )}
                    </FormField>
                    <FormField
                      id={`product-variant-${variant.id}-name`}
                      label={`نام تنوع ${number}`}
                      hint="اختیاری"
                    >
                      {(props) => (
                        <Input
                          {...props}
                          value={variant.name}
                          placeholder={sizeMode === 'SIZED' ? 'مثلاً سایز ۵۲' : 'مثلاً مدل طلایی'}
                          maxLength={150}
                          disabled={pending}
                          onChange={(event) => updateVariant({ name: event.target.value })}
                        />
                      )}
                    </FormField>
                    {sizeMode === 'SIZED' ? (
                      <FormField
                        id={`product-variant-${variant.id}-size`}
                        label={`سایز تنوع ${number}`}
                        required
                      >
                        {(props) => (
                          <Select
                            {...props}
                            value={variant.sizeId}
                            disabled={pending}
                            required
                            onValueChange={(value) => updateVariant({ sizeId: value })}
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
                    <FormField
                      id={`product-variant-${variant.id}-weight`}
                      label={`وزن تنوع ${number} به گرم`}
                      hint="اختیاری؛ حداکثر سه رقم اعشار"
                    >
                      {(props) => (
                        <Input
                          {...props}
                          value={variant.weightGrams}
                          placeholder="مثلاً ۴٫۲۵"
                          inputMode="decimal"
                          disabled={pending}
                          onChange={(event) =>
                            updateVariant({
                              weightGrams: toPersianDigits(toAsciiDigits(event.target.value)),
                            })
                          }
                        />
                      )}
                    </FormField>
                  </div>
                </section>
              );
            })}
          </div>
        </Card>
      ) : (
        <Card
          title="تنوع‌ها و سایزبندی"
          description={`این محصول ${toPersianDigits(product?.variants.length ?? 0)} تنوع دارد؛ SKU، سایز، وزن و وضعیت هر تنوع در بخش مستقل مدیریت می‌شود.`}
          action={
            product ? (
              <ButtonLink href={`/variants/${product.id}`} size="sm">
                مدیریت تنوع‌ها
              </ButtonLink>
            ) : null
          }
        >
          <p className="text-sm leading-7 text-[var(--admin-color-muted)]">
            تغییرات این فرم فقط اطلاعات اصلی محصول را ذخیره می‌کند و روی تنوع‌ها اثر نمی‌گذارد.
          </p>
        </Card>
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
