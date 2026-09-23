'use client';

import { useRouter } from 'next/navigation';
import { type ChangeEvent, type FormEvent, useId, useState } from 'react';

import {
  createSeoEditorValue,
  isValidSeoCanonicalPath,
  SeoEditor,
  seoEditorPayload,
} from '@/components/seo/seo-editor';
import { RelatedProductPicker } from '@/components/products/related-product-picker';
import { Alert } from '@/components/ui/alert';
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
  salePriceToman: string;
  compareAtPriceToman: string;
}>;

const MAX_PRODUCT_IMAGES = 12;
const MAX_PRODUCT_IMAGE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_PRODUCT_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
]);

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
    salePriceToman: '',
    compareAtPriceToman: '',
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

async function uploadProductImages(files: readonly File[], altText: string) {
  const uploaded: Array<{
    mediaId: string;
    sortOrder: number;
    isPrimary: boolean;
    altText: string;
  }> = [];

  for (const [index, file] of files.entries()) {
    const body = new FormData();
    body.set('file', file);
    body.set('altText', altText);
    const response = await fetch('/api/catalog/media', { method: 'POST', body });
    const payload = (await response.json().catch(() => null)) as unknown;
    if (!response.ok) throw new Error(apiError(payload));
    const mediaId =
      typeof payload === 'object' &&
      payload !== null &&
      typeof (payload as { id?: unknown }).id === 'string'
        ? (payload as { id: string }).id
        : null;
    if (!mediaId) throw new Error('شناسه تصویر بارگذاری‌شده دریافت نشد. دوباره تلاش کنید.');
    uploaded.push({ mediaId, sortOrder: index, isPrimary: index === 0, altText });
  }

  return uploaded;
}

export function ProductForm({ data, mode }: ProductFormProps) {
  const router = useRouter();
  const productImagesInputId = useId();
  const product = data.product;
  const [sizeMode, setSizeMode] = useState<ProductSizeMode>(product?.sizeMode ?? 'NONE');
  const [sizeGroupId, setSizeGroupId] = useState(product?.sizeGroup?.id ?? 'none');
  const [seo, setSeo] = useState(() => createSeoEditorValue(product));
  const [attributes, setAttributes] = useState<EditableProductAttribute[]>(() =>
    (product?.attributes ?? []).map((attribute) => ({
      id: attribute.id,
      key: attribute.key,
      value: attribute.value,
    })),
  );
  const [variants, setVariants] = useState<EditableProductVariant[]>(() => [createVariant()]);
  const [productImages, setProductImages] = useState<readonly File[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function selectProductImages(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? []);
    if (files.length > MAX_PRODUCT_IMAGES) {
      event.currentTarget.value = '';
      setProductImages([]);
      setError('حداکثر ۱۲ تصویر برای هر محصول مجاز است.');
      return;
    }
    if (
      files.some(
        (file) =>
          !ACCEPTED_PRODUCT_IMAGE_TYPES.has(file.type) || file.size > MAX_PRODUCT_IMAGE_BYTES,
      )
    ) {
      event.currentTarget.value = '';
      setProductImages([]);
      setError('هر تصویر باید JPEG، PNG، WebP یا AVIF و حداکثر ۱۰ مگابایت باشد.');
      return;
    }
    setError(null);
    setProductImages(files);
  }

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
    const defaultPlatingType = String(formData.get('defaultPlatingType') ?? 'none');
    const platingTypes = formData.getAll('platingTypes').map(String);
    const relatedProductIds = formData.getAll('relatedProductIds').map(String);
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
      defaultPlatingType: defaultPlatingType === 'none' ? null : defaultPlatingType,
      platingTypes,
      ...seoEditorPayload(seo),
    };

    if (mode === 'create') {
      const normalizedVariants = variants.map((variant) => ({
        sku: variant.sku.trim(),
        name: variant.name.trim(),
        sizeId: variant.sizeId,
        weightGrams: optionalNumberValue(variant.weightGrams),
        salePriceToman: optionalNumberValue(variant.salePriceToman),
        compareAtPriceToman: optionalNumberValue(variant.compareAtPriceToman),
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
      if (
        normalizedVariants.some(
          (variant) =>
            Number.isNaN(variant.salePriceToman) || Number.isNaN(variant.compareAtPriceToman),
        )
      ) {
        setError('قیمت تنوع‌ها باید فقط شامل عدد باشد.');
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
        if (sizeGroupId === 'none') {
          setError('برای محصول سایزبندی‌شده انتخاب گروه سایزبندی الزامی است.');
          return;
        }
        const sizeIds = normalizedVariants.map((variant) => variant.sizeId);
        if (new Set(sizeIds).size !== sizeIds.length) {
          setError('هر سایز فقط می‌تواند به یک تنوع این محصول اختصاص داده شود.');
          return;
        }
        const allowedSizeIds = new Set(
          data.sizes.filter((size) => size.groupId === sizeGroupId).map((size) => size.id),
        );
        if (sizeIds.some((sizeId) => !allowedSizeIds.has(sizeId))) {
          setError('تمام تنوع‌ها باید از گروه سایزبندی انتخاب‌شده باشند.');
          return;
        }
      }
      for (const variant of normalizedVariants) {
        const effectiveSalePrice = variant.salePriceToman ?? salePriceToman;
        const effectiveComparePrice = variant.compareAtPriceToman ?? compareAtPriceToman;
        if (effectiveSalePrice === undefined) {
          setError('برای هر تنوع قیمت فروش مستقل یا قیمت پیش‌فرض محصول را ثبت کنید.');
          return;
        }
        if (effectiveComparePrice !== undefined && effectiveComparePrice <= effectiveSalePrice) {
          setError('قیمت قبل از تخفیف هر تنوع باید بیشتر از قیمت فروش آن باشد.');
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
        ...(variant.salePriceToman !== undefined ? { salePriceToman: variant.salePriceToman } : {}),
        ...(variant.compareAtPriceToman !== undefined
          ? { compareAtPriceToman: variant.compareAtPriceToman }
          : {}),
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
      if (mode === 'create' && productImages.length > 0) {
        payload.media = await uploadProductImages(productImages, name);
      }

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
      const savedProductId = createdProductId ?? product?.id;
      if (savedProductId && (mode === 'edit' || relatedProductIds.length > 0)) {
        const relationResponse = await fetch(`/api/catalog/products/${savedProductId}/relations`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ relatedProductIds }),
        });
        if (!relationResponse.ok) {
          throw new Error(apiError(await relationResponse.json().catch(() => null)));
        }
      }
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
        <Card
          title="قیمت‌گذاری"
          description="این مبالغ پیش‌فرض هستند؛ قیمت ثبت‌شده روی هر تنوع اولویت دارد."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="product-sale-price" label="قیمت فروش پیش‌فرض">
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
            <FormField id="product-compare-price" label="قیمت قبل از تخفیف پیش‌فرض">
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

      <Card
        title="آبکاری پیش‌فرض محصول"
        description="آبکاری انتخاب‌شده همراه خود محصول است و برای مشتری هزینه اضافه ندارد. سایر گزینه‌های آبکاری همچنان با نرخ تنظیم‌شده محاسبه می‌شوند."
      >
        <div className="space-y-5">
          <FormField id="product-default-plating" label="نوع آبکاری پیش‌فرض">
            {(props) => (
              <Select
                {...props}
                name="defaultPlatingType"
                defaultValue={product?.defaultPlatingType ?? 'none'}
                options={[
                  { value: 'none', label: 'بدون آبکاری پیش‌فرض' },
                  { value: 'RHODIUM', label: 'آبکاری رودیوم' },
                  { value: 'GOLD', label: 'آبکاری طلایی' },
                  { value: 'ROSE_GOLD', label: 'آبکاری رزگلد' },
                ]}
              />
            )}
          </FormField>
          <fieldset>
            <legend className="text-sm font-bold">آبکاری‌های سفارشی قابل انتخاب مشتری</legend>
            <p className="mt-1 text-xs leading-6 text-[var(--admin-color-muted)]">
              هزینه این گزینه‌ها بر اساس وزن تنوع و نرخ فعال تنظیمات آبکاری محاسبه می‌شود.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {[
                ['RHODIUM', 'رودیوم'],
                ['GOLD', 'طلایی'],
                ['ROSE_GOLD', 'رزگلد'],
              ].map(([value, label]) => (
                <Checkbox
                  key={value}
                  id={`product-plating-${value}`}
                  name="platingTypes"
                  value={value}
                  label={label}
                  defaultChecked={product?.platingTypes?.includes(
                    value as 'GOLD' | 'ROSE_GOLD' | 'RHODIUM',
                  )}
                />
              ))}
            </div>
          </fieldset>
        </div>
      </Card>

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
        title="محصولات مرتبط"
        description="با جست‌وجوی نام، اسلاگ یا SKU محصول موردنظر را پیدا کنید. ارتباط‌ها دوطرفه هستند و در صفحه هر دو محصول اعمال می‌شوند."
      >
        {(data.products ?? []).length ? (
          <RelatedProductPicker
            products={data.products ?? []}
            initialSelectedIds={data.relatedProductIds ?? []}
            disabled={pending}
          />
        ) : (
          <p className="text-sm text-[var(--admin-color-muted)]">
            محصول دیگری برای ارتباط‌سازی وجود ندارد.
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

      {mode === 'create' ? (
        <Card
          title="تصاویر محصول"
          description="تصاویر را همین‌جا انتخاب کنید؛ هنگام ساخت محصول بارگذاری و به‌ترتیب انتخاب ثبت می‌شوند."
        >
          <label
            htmlFor={productImagesInputId}
            className="grid min-h-36 cursor-pointer place-items-center rounded-[var(--admin-radius-lg)] border border-dashed border-[var(--admin-color-border-strong)] bg-[var(--admin-color-surface-subtle)] p-5 text-center outline-none focus-within:shadow-[var(--admin-focus-ring)]"
          >
            <span>
              <strong className="block text-sm">افزودن تصاویر محصول</strong>
              <span className="mt-2 block text-xs leading-5 text-[var(--admin-color-muted)]">
                JPEG، PNG، WebP یا AVIF؛ حداکثر ۱۲ تصویر و هر فایل حداکثر ۱۰ مگابایت
              </span>
              {productImages.length > 0 ? (
                <span className="mt-3 block text-sm font-bold text-[var(--admin-color-success)]">
                  {toPersianDigits(productImages.length)} تصویر انتخاب شد
                </span>
              ) : null}
            </span>
            <input
              id={productImagesInputId}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              multiple
              className="sr-only"
              disabled={pending}
              aria-label="انتخاب تصاویر محصول از دستگاه"
              onChange={selectProductImages}
            />
          </label>

          {productImages.length > 0 ? (
            <ul className="mt-4 grid gap-2 sm:grid-cols-2" aria-label="تصاویر انتخاب‌شده محصول">
              {productImages.map((file, index) => (
                <li
                  key={`${file.name}-${file.lastModified}-${index}`}
                  className="flex items-center justify-between gap-3 rounded-[var(--admin-radius-md)] border border-[var(--admin-color-border)] px-3 py-2"
                >
                  <span className="min-w-0 truncate text-xs" dir="auto">
                    {toPersianDigits(index + 1)}. {file.name}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() =>
                      setProductImages((current) =>
                        current.filter((_, currentIndex) => currentIndex !== index),
                      )
                    }
                  >
                    حذف
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
        </Card>
      ) : null}

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
                  onValueChange={(value) => {
                    setSizeMode(value as ProductSizeMode);
                    if (value !== 'SIZED') setSizeGroupId('none');
                  }}
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
              <FormField
                id="product-size-group"
                label="گروه سایزبندی"
                hint="فقط مقادیر همین گروه برای تنوع‌ها نمایش داده می‌شوند."
                required
              >
                {(props) => (
                  <Select
                    {...props}
                    value={sizeGroupId}
                    onValueChange={(value) => {
                      setSizeGroupId(value);
                      setVariants((current) =>
                        current.map((variant) => ({ ...variant, sizeId: 'none' })),
                      );
                    }}
                    options={[
                      { value: 'none', label: 'انتخاب گروه سایزبندی' },
                      ...data.sizeGroups
                        .filter((group) => group.active)
                        .map((group) => ({ value: group.id, label: group.name })),
                    ]}
                  />
                )}
              </FormField>
            ) : null}
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
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
                                .filter((size) => size.active && size.groupId === sizeGroupId)
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
                    <FormField
                      id={`product-variant-${variant.id}-sale-price`}
                      label={`قیمت فروش تنوع ${number}`}
                      hint="اختیاری؛ جایگزین قیمت پیش‌فرض"
                    >
                      {(props) => (
                        <MoneyInput
                          {...props}
                          value={variant.salePriceToman}
                          placeholder="مثلاً ۴٬۷۰۰٬۰۰۰"
                          disabled={pending}
                          onChange={(event) =>
                            updateVariant({ salePriceToman: event.currentTarget.value })
                          }
                        />
                      )}
                    </FormField>
                    <FormField
                      id={`product-variant-${variant.id}-compare-price`}
                      label={`قیمت قبل از تخفیف تنوع ${number}`}
                      hint="اختیاری"
                    >
                      {(props) => (
                        <MoneyInput
                          {...props}
                          value={variant.compareAtPriceToman}
                          placeholder="مثلاً ۵٬۲۰۰٬۰۰۰"
                          disabled={pending}
                          onChange={(event) =>
                            updateVariant({ compareAtPriceToman: event.currentTarget.value })
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
