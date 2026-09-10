'use client';

/* eslint-disable @next/next/no-img-element -- media host is configured at runtime on the API/VPS. */
import { useRouter } from 'next/navigation';
import { type FormEvent, useId, useMemo, useState } from 'react';

import { Alert } from '@/components/ui/alert';
import {
  createSeoEditorValue,
  isValidSeoCanonicalPath,
  SeoEditor,
  seoEditorPayload,
} from '@/components/seo/seo-editor';
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
import type { AdminBrand, AdminCountry } from '@/lib/catalog/catalog-model';
import {
  formatAdminDateTime,
  formatAdminInteger,
  toPersianDigits,
} from '@/lib/presentation/formatters';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);

type ReferenceKind = 'brand' | 'country';
type CatalogReference = AdminBrand | AdminCountry;

type ReferenceManagementViewProps = Readonly<{
  brands: readonly AdminBrand[];
  countries: readonly AdminCountry[];
  brandsFailed: boolean;
  countriesFailed: boolean;
  canWrite: boolean;
}>;

const COPY = {
  brand: {
    singular: 'برند',
    plural: 'برندها',
    add: 'افزودن برند',
    search: 'جستجو در نام یا اسلاگ برند',
    empty: 'برندی پیدا نشد',
  },
  country: {
    singular: 'کشور',
    plural: 'کشورها',
    add: 'افزودن کشور',
    search: 'جستجو در نام، اسلاگ یا کد کشور',
    empty: 'کشوری پیدا نشد',
  },
} as const;

function responseError(payload: unknown): string {
  const translations: Record<string, string> = {
    'A brand with this slug already exists.': 'برند دیگری با این اسلاگ ثبت شده است.',
    'A country with this slug or ISO code already exists.':
      'کشور دیگری با این اسلاگ یا کد دوحرفی ثبت شده است.',
    'A brand assigned to products cannot be archived.':
      'برندی که به محصول متصل است قابل آرشیو نیست.',
    'A country assigned to products cannot be archived.':
      'کشوری که به محصول متصل است قابل آرشیو نیست.',
    'Brand was not found.': 'برند پیدا نشد.',
    'Country was not found.': 'کشور پیدا نشد.',
  };
  if (typeof payload === 'object' && payload !== null) {
    const value = payload as Record<string, unknown>;
    if (typeof value.message === 'string') return translations[value.message] ?? value.message;
    if (Array.isArray(value.message)) return value.message.join('، ');
    const nested = value.error as Record<string, unknown> | undefined;
    if (typeof nested?.message === 'string') return translations[nested.message] ?? nested.message;
  }
  return 'عملیات انجام نشد. دوباره تلاش کنید.';
}

function referenceStatus(reference: CatalogReference) {
  return (
    <Badge tone={reference.active ? 'success' : 'neutral'} dot>
      {reference.active ? 'فعال' : 'غیرفعال'}
    </Badge>
  );
}

function ReferenceIdentity({ reference }: Readonly<{ reference: CatalogReference }>) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-[var(--admin-radius-md)] bg-[var(--admin-color-primary-soft)] font-black text-[var(--admin-color-primary)]">
        {reference.image ? (
          <img
            src={reference.image.url}
            alt=""
            className="h-full w-full object-contain p-1"
            loading="lazy"
          />
        ) : (
          reference.name.slice(0, 1)
        )}
      </span>
      <span className="min-w-0">
        <span className="block truncate font-bold">{reference.name}</span>
        <span dir="ltr" className="mt-0.5 block truncate text-xs text-[var(--admin-color-subtle)]">
          {toPersianDigits(reference.slug)}
        </span>
      </span>
    </div>
  );
}

async function requestJson(path: string, method: 'POST' | 'PATCH' | 'DELETE', body?: unknown) {
  const response = await fetch(path, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) throw new Error(responseError(payload));
  return payload;
}

type ReferenceFormProps = Readonly<{
  formId: string;
  kind: ReferenceKind;
  reference?: CatalogReference;
  onSaved: () => void;
  onPendingChange: (pending: boolean) => void;
}>;

function ReferenceForm({ formId, kind, reference, onSaved, onPendingChange }: ReferenceFormProps) {
  const router = useRouter();
  const fileInputId = useId();
  const heroFileInputId = useId();
  const [file, setFile] = useState<File | null>(null);
  const [heroFile, setHeroFile] = useState<File | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [removeHeroImage, setRemoveHeroImage] = useState(false);
  const [archiveConfirmation, setArchiveConfirmation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const copy = COPY[kind];
  const resource = kind === 'brand' ? 'brands' : 'countries';
  const brandReference = kind === 'brand' ? (reference as AdminBrand | undefined) : undefined;
  const [seo, setSeo] = useState(() => createSeoEditorValue(brandReference));
  const archiveBlocked = Boolean(reference && reference.productCount > 0);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const name = String(formData.get('name') ?? '').trim();
    const slug = String(formData.get('slug') ?? '').trim();
    const description = String(formData.get('description') ?? '').trim();
    const isoCode = String(formData.get('isoCode') ?? '')
      .trim()
      .toUpperCase();
    if (!name || !slug) return setError(`نام و اسلاگ ${copy.singular} الزامی هستند.`);
    if (kind === 'country' && !/^[A-Z]{2}$/.test(isoCode)) {
      return setError('کد کشور باید دقیقاً دو حرف انگلیسی باشد.');
    }
    if (kind === 'brand' && !isValidSeoCanonicalPath(seo.canonicalPath.trim()))
      return setError('مسیر canonical باید یک مسیر داخلی بدون query یا fragment باشد.');
    if (file && (!ACCEPTED_IMAGE_TYPES.has(file.type) || file.size > MAX_IMAGE_BYTES)) {
      return setError(
        `${kind === 'brand' ? 'لوگو' : 'تصویر'} باید JPEG، PNG، WebP یا AVIF و حداکثر ۱۰ مگابایت باشد.`,
      );
    }
    if (heroFile && (!ACCEPTED_IMAGE_TYPES.has(heroFile.type) || heroFile.size > MAX_IMAGE_BYTES)) {
      return setError('تصویر Hero باید JPEG، PNG، WebP یا AVIF و حداکثر ۱۰ مگابایت باشد.');
    }

    setError(null);
    onPendingChange(true);
    let referenceSaved = false;
    try {
      const payload = await requestJson(
        reference ? `/api/catalog/${resource}/${reference.id}` : `/api/catalog/${resource}`,
        reference ? 'PATCH' : 'POST',
        {
          name,
          slug,
          description: description || null,
          ...(kind === 'country' ? { isoCode } : {}),
          ...(kind === 'brand' ? seoEditorPayload(seo) : {}),
          isActive: formData.get('isActive') === 'on',
        },
      );
      const result =
        typeof payload === 'object' && payload !== null
          ? (payload as Record<string, unknown>)
          : null;
      const savedId = reference?.id ?? (typeof result?.id === 'string' ? result.id : null);
      if (!savedId) throw new Error(`شناسه ${copy.singular} جدید از سرور دریافت نشد.`);
      referenceSaved = true;

      if (file) {
        const imageData = new FormData();
        imageData.set('file', file);
        imageData.set('altText', name);
        const response = await fetch(`/api/catalog/${resource}/${savedId}/image`, {
          method: 'POST',
          body: imageData,
        });
        const imagePayload = (await response.json().catch(() => null)) as unknown;
        if (!response.ok) throw new Error(responseError(imagePayload));
      } else if (reference?.image && removeImage) {
        await requestJson(`/api/catalog/${resource}/${reference.id}/image`, 'DELETE');
      }

      if (kind === 'brand' && heroFile) {
        const heroData = new FormData();
        heroData.set('file', heroFile);
        heroData.set('altText', `تصویر Hero ${name}`);
        const response = await fetch(`/api/catalog/brands/${savedId}/hero-image`, {
          method: 'POST',
          body: heroData,
        });
        const heroPayload = (await response.json().catch(() => null)) as unknown;
        if (!response.ok) throw new Error(responseError(heroPayload));
      } else if (brandReference?.heroImage && removeHeroImage) {
        await requestJson(`/api/catalog/brands/${savedId}/hero-image`, 'DELETE');
      }

      onSaved();
      router.refresh();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : responseError(null);
      setError(
        referenceSaved ? `اطلاعات ذخیره شد؛ اما عملیات تصویر ناموفق بود: ${message}` : message,
      );
      if (referenceSaved) router.refresh();
    } finally {
      onPendingChange(false);
    }
  }

  async function archive() {
    if (!reference || archiveBlocked || !archiveConfirmation) return;
    setError(null);
    onPendingChange(true);
    try {
      await requestJson(`/api/catalog/${resource}/${reference.id}`, 'DELETE');
      onSaved();
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : responseError(null));
    } finally {
      onPendingChange(false);
    }
  }

  return (
    <form id={formId} onSubmit={(event) => void submit(event)} className="space-y-4">
      {error ? (
        <Alert tone="danger" title="عملیات ناموفق بود">
          {error}
        </Alert>
      ) : null}

      {reference ? (
        <dl className="grid grid-cols-2 gap-2 rounded-[var(--admin-radius-md)] bg-[var(--admin-color-surface-subtle)] p-3 text-center">
          <div>
            <dt className="text-[0.6875rem] text-[var(--admin-color-muted)]">محصول متصل</dt>
            <dd className="mt-1 text-sm font-black">
              {formatAdminInteger(reference.productCount)}
            </dd>
          </div>
          <div>
            <dt className="text-[0.6875rem] text-[var(--admin-color-muted)]">آخرین ویرایش</dt>
            <dd className="mt-1 text-xs font-bold">{formatAdminDateTime(reference.updatedAt)}</dd>
          </div>
        </dl>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id={`${formId}-name`} label={`نام ${copy.singular}`} required>
          {(props) => (
            <Input
              {...props}
              name="name"
              defaultValue={reference?.name}
              placeholder={kind === 'brand' ? 'مثلاً حمیدیان' : 'مثلاً ایران'}
              maxLength={kind === 'brand' ? 150 : 120}
              required
            />
          )}
        </FormField>
        <FormField
          id={`${formId}-slug`}
          label="اسلاگ"
          hint={
            kind === 'brand' && reference
              ? 'تغییر اسلاگ، آدرس قبلی برند را با انتقال دائمی حفظ می‌کند.'
              : undefined
          }
          required
        >
          {(props) => (
            <Input
              {...props}
              name="slug"
              defaultValue={reference?.slug}
              placeholder={kind === 'brand' ? 'hamidian' : 'iran'}
              dir="ltr"
              maxLength={kind === 'brand' ? 180 : 160}
              required
            />
          )}
        </FormField>
        {kind === 'country' ? (
          <FormField id={`${formId}-iso`} label="کد دوحرفی کشور" required>
            {(props) => (
              <Input
                {...props}
                name="isoCode"
                defaultValue={
                  'isoCode' in (reference ?? {}) ? (reference as AdminCountry).isoCode : ''
                }
                placeholder="IR"
                dir="ltr"
                maxLength={2}
                autoCapitalize="characters"
                required
              />
            )}
          </FormField>
        ) : null}
      </div>

      <FormField id={`${formId}-description`} label="توضیحات">
        {(props) => (
          <Textarea
            {...props}
            name="description"
            defaultValue={reference?.description ?? ''}
            placeholder={`توضیح کوتاه درباره ${copy.singular}`}
          />
        )}
      </FormField>

      <section className="rounded-[var(--admin-radius-md)] border border-[var(--admin-color-border)] p-3">
        <div className="flex items-center gap-3">
          {reference?.image && !removeImage && !file ? (
            <img
              src={reference.image.url}
              alt={reference.image.altText ?? reference.name}
              className={`size-16 rounded-[var(--admin-radius-md)] ${kind === 'brand' ? 'object-contain p-1' : 'object-cover'}`}
            />
          ) : (
            <span className="grid size-16 place-items-center rounded-[var(--admin-radius-md)] bg-[var(--admin-color-surface-subtle)] text-xs text-[var(--admin-color-muted)]">
              {kind === 'brand' ? 'بدون لوگو' : 'بدون تصویر'}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <label htmlFor={fileInputId} className="text-sm font-bold">
              {kind === 'brand' ? 'لوگوی برند' : `تصویر ${copy.singular}`}
            </label>
            <p className="mt-1 truncate text-xs text-[var(--admin-color-muted)]">
              {file ? file.name : 'JPEG، PNG، WebP یا AVIF تا ۱۰ مگابایت'}
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <label
            htmlFor={fileInputId}
            className="inline-flex min-h-9 cursor-pointer items-center rounded-[var(--admin-radius-md)] border border-[var(--admin-color-border)] px-3 text-xs font-semibold hover:bg-[var(--admin-color-surface-subtle)]"
          >
            {kind === 'brand' ? 'انتخاب لوگو' : 'انتخاب تصویر'}
          </label>
          <input
            id={fileInputId}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            className="sr-only"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setRemoveImage(false);
            }}
          />
          {reference?.image && !file ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setRemoveImage((current) => !current)}
            >
              {removeImage
                ? `لغو حذف ${kind === 'brand' ? 'لوگو' : 'تصویر'}`
                : `حذف ${kind === 'brand' ? 'لوگوی' : 'تصویر'} فعلی`}
            </Button>
          ) : null}
        </div>
      </section>

      {kind === 'brand' ? (
        <section className="rounded-[var(--admin-radius-md)] border border-[var(--admin-color-border)] p-3">
          <div className="overflow-hidden rounded-[var(--admin-radius-md)] bg-[var(--admin-color-surface-subtle)]">
            {brandReference?.heroImage && !removeHeroImage && !heroFile ? (
              <img
                src={brandReference.heroImage.url}
                alt={brandReference.heroImage.altText ?? `تصویر Hero ${brandReference.name}`}
                className="aspect-[16/7] w-full object-cover"
              />
            ) : (
              <span className="grid aspect-[16/7] w-full place-items-center text-xs text-[var(--admin-color-muted)]">
                بدون تصویر Hero
              </span>
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <label htmlFor={heroFileInputId} className="text-sm font-bold">
                تصویر Hero صفحه برند
              </label>
              <p className="mt-1 truncate text-xs text-[var(--admin-color-muted)]">
                {heroFile ? heroFile.name : 'تصویر افقی JPEG، PNG، WebP یا AVIF تا ۱۰ مگابایت'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <label
                htmlFor={heroFileInputId}
                className="inline-flex min-h-9 cursor-pointer items-center rounded-[var(--admin-radius-md)] border border-[var(--admin-color-border)] px-3 text-xs font-semibold hover:bg-[var(--admin-color-surface-subtle)]"
              >
                انتخاب تصویر Hero
              </label>
              <input
                id={heroFileInputId}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                className="sr-only"
                onChange={(event) => {
                  setHeroFile(event.target.files?.[0] ?? null);
                  setRemoveHeroImage(false);
                }}
              />
              {brandReference?.heroImage && !heroFile ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setRemoveHeroImage((current) => !current)}
                >
                  {removeHeroImage ? 'لغو حذف Hero' : 'حذف Hero فعلی'}
                </Button>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {kind === 'brand' ? (
        <SeoEditor
          value={seo}
          onChange={setSeo}
          canonicalPlaceholder={`/brands/${brandReference?.slug ?? 'brand-slug'}`}
          defaultTitle={brandReference?.name ?? 'نام برند'}
          uploadUrl="/api/catalog/media"
          idPrefix={`${formId}-seo`}
        />
      ) : null}

      <Checkbox
        id={`${formId}-active`}
        name="isActive"
        label={`${copy.singular} فعال باشد`}
        description={`${copy.singular} غیرفعال در انتخاب‌های کاتالوگ نمایش داده نمی‌شود.`}
        defaultChecked={reference?.active ?? true}
      />

      {reference ? (
        <section className="border-t border-[var(--admin-color-border)] pt-4">
          {archiveBlocked ? (
            <Alert tone="warning">
              برای آرشیو، ابتدا محصولات متصل را به {copy.singular} دیگری منتقل کنید.
            </Alert>
          ) : archiveConfirmation ? (
            <Alert
              tone="danger"
              title={`آرشیو این ${copy.singular}؟`}
              action={
                <Button type="button" size="sm" variant="danger" onClick={() => void archive()}>
                  تأیید آرشیو
                </Button>
              }
            >
              این مورد از فهرست مدیریت فعال حذف می‌شود.
            </Alert>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setArchiveConfirmation(true)}
            >
              آرشیو {copy.singular}
            </Button>
          )}
        </section>
      ) : null}
    </form>
  );
}

function ReferenceSheet({
  kind,
  reference,
  triggerLabel,
}: Readonly<{ kind: ReferenceKind; reference?: CatalogReference; triggerLabel: string }>) {
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const copy = COPY[kind];
  return (
    <BottomSheet open={open} onOpenChange={setOpen}>
      <BottomSheetTrigger asChild>
        <Button size="sm" variant={reference ? 'outline' : 'primary'}>
          {triggerLabel}
        </Button>
      </BottomSheetTrigger>
      <BottomSheetContent
        title={reference ? `ویرایش ${reference.name}` : copy.add}
        description={
          kind === 'brand'
            ? 'اطلاعات، لوگو، تصویر Hero و وضعیت برند را تنظیم کنید.'
            : `اطلاعات، تصویر و وضعیت ${copy.singular} را تنظیم کنید.`
        }
        height="large"
        footer={
          <>
            <Button variant="outline" disabled={pending} onClick={() => setOpen(false)}>
              انصراف
            </Button>
            <Button type="submit" form={formId} loading={pending}>
              ذخیره {copy.singular}
            </Button>
          </>
        }
      >
        <ReferenceForm
          formId={formId}
          kind={kind}
          reference={reference}
          onSaved={() => setOpen(false)}
          onPendingChange={setPending}
        />
      </BottomSheetContent>
    </BottomSheet>
  );
}

function ReadonlyDetails({
  kind,
  reference,
}: Readonly<{ kind: ReferenceKind; reference: CatalogReference }>) {
  const rows = [
    ['نام', reference.name],
    ['وضعیت', reference.active ? 'فعال' : 'غیرفعال'],
    ['اسلاگ', toPersianDigits(reference.slug)],
    ...(kind === 'country' && 'isoCode' in reference ? [['کد کشور', reference.isoCode]] : []),
    ['محصول متصل', formatAdminInteger(reference.productCount)],
    ['توضیحات', reference.description ?? 'ثبت نشده'],
    [kind === 'brand' ? 'لوگو' : 'تصویر', reference.image ? 'ثبت شده' : 'ثبت نشده'],
    ...(kind === 'brand'
      ? [['تصویر Hero', (reference as AdminBrand).heroImage ? 'ثبت شده' : 'ثبت نشده']]
      : []),
    ['آخرین ویرایش', formatAdminDateTime(reference.updatedAt)],
  ];
  return (
    <dl className="divide-y divide-[var(--admin-color-border)]">
      {rows.map(([label, value]) => (
        <div key={label} className="flex justify-between gap-4 py-3 text-sm">
          <dt className="text-[var(--admin-color-muted)]">{label}</dt>
          <dd className="max-w-[65%] text-left font-semibold">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function ReferenceMobileCard({
  kind,
  reference,
  canWrite,
}: Readonly<{ kind: ReferenceKind; reference: CatalogReference; canWrite: boolean }>) {
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  return (
    <MobileDataCard
      eyebrow={kind === 'brand' ? 'برند محصول' : 'کشور سازنده'}
      title={reference.name}
      status={referenceStatus(reference)}
      items={[
        { label: 'محصول', value: formatAdminInteger(reference.productCount) },
        {
          label: kind === 'brand' ? 'رسانه‌ها' : 'تصویر',
          value:
            kind === 'brand'
              ? `${reference.image ? 'لوگو' : 'بدون لوگو'} / ${(reference as AdminBrand).heroImage ? 'Hero' : 'بدون Hero'}`
              : reference.image
                ? 'دارد'
                : 'ندارد',
        },
        {
          label: kind === 'country' ? 'کد کشور' : 'وضعیت',
          value:
            kind === 'country' && 'isoCode' in reference
              ? reference.isoCode
              : reference.active
                ? 'فعال'
                : 'غیرفعال',
        },
      ]}
      detailsTitle={reference.name}
      detailsDescription="جزئیات کامل و عملیات"
      detailsOpen={open}
      onDetailsOpenChange={setOpen}
      details={
        canWrite ? (
          <ReferenceForm
            formId={formId}
            kind={kind}
            reference={reference}
            onSaved={() => setOpen(false)}
            onPendingChange={setPending}
          />
        ) : (
          <ReadonlyDetails kind={kind} reference={reference} />
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

function ReferencePanel({
  kind,
  items,
  failed,
  canWrite,
}: Readonly<{
  kind: ReferenceKind;
  items: readonly CatalogReference[];
  failed: boolean;
  canWrite: boolean;
}>) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const copy = COPY[kind];
  const normalizedQuery = query.trim().toLocaleLowerCase('fa');
  const filtered = useMemo(
    () =>
      items.filter((item) => {
        const iso = 'isoCode' in item ? item.isoCode.toLocaleLowerCase('en') : '';
        const matchesQuery =
          !normalizedQuery ||
          item.name.toLocaleLowerCase('fa').includes(normalizedQuery) ||
          item.slug.toLocaleLowerCase('en').includes(normalizedQuery) ||
          iso.includes(normalizedQuery);
        return (
          matchesQuery && (status === 'all' || (status === 'active' ? item.active : !item.active))
        );
      }),
    [items, normalizedQuery, status],
  );
  const columns: readonly DataTableColumn<CatalogReference>[] = [
    {
      id: 'identity',
      header: copy.singular,
      cell: (item) => <ReferenceIdentity reference={item} />,
    },
    ...(kind === 'country'
      ? [
          {
            id: 'iso',
            header: 'کد کشور',
            cell: (item: CatalogReference) => ('isoCode' in item ? item.isoCode : '—'),
          },
        ]
      : []),
    {
      id: 'products',
      header: 'محصول',
      align: 'center',
      cell: (item) => formatAdminInteger(item.productCount),
    },
    {
      id: 'image',
      header: kind === 'brand' ? 'رسانه‌ها' : 'تصویر',
      align: 'center',
      cell: (item) =>
        kind === 'brand'
          ? `${item.image ? 'لوگو' : '—'} / ${(item as AdminBrand).heroImage ? 'Hero' : '—'}`
          : item.image
            ? 'ثبت شده'
            : 'ندارد',
    },
    { id: 'status', header: 'وضعیت', cell: referenceStatus },
    {
      id: 'actions',
      header: 'عملیات',
      align: 'end',
      cell: (item) =>
        canWrite ? (
          <ReferenceSheet kind={kind} reference={item} triggerLabel="ویرایش" />
        ) : (
          <span className="text-xs text-[var(--admin-color-subtle)]">فقط مشاهده</span>
        ),
    },
  ];
  const activeCount = (normalizedQuery ? 1 : 0) + (status === 'all' ? 0 : 1);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[
          [`کل ${copy.plural}`, items.length],
          ['فعال', items.filter((item) => item.active).length],
          ['متصل به محصول', items.filter((item) => item.productCount > 0).length],
        ].map(([label, value]) => (
          <Card key={String(label)} className="p-0">
            <p className="text-xs text-[var(--admin-color-muted)]">{label}</p>
            <p className="mt-2 text-2xl font-black">{formatAdminInteger(Number(value))}</p>
          </Card>
        ))}
      </div>
      <FilterBar
        activeCount={activeCount}
        resetAction={
          activeCount ? (
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
        actions={canWrite ? <ReferenceSheet kind={kind} triggerLabel={copy.add} /> : null}
      >
        <SearchField
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={copy.search}
          aria-label={`جستجوی ${copy.plural}`}
        />
        <Select
          value={status}
          onValueChange={setStatus}
          aria-label="فیلتر وضعیت"
          options={[
            { value: 'all', label: 'همه وضعیت‌ها' },
            { value: 'active', label: 'فعال' },
            { value: 'inactive', label: 'غیرفعال' },
          ]}
        />
      </FilterBar>
      <ResponsiveDataView
        mobileLabel={`کارت‌های ${copy.plural}`}
        renderMobileCard={(item) => (
          <ReferenceMobileCard kind={kind} reference={item} canWrite={canWrite} />
        )}
        caption={`جدول ${copy.plural}`}
        columns={columns}
        rows={filtered}
        getRowKey={(item) => item.id}
        error={failed ? { description: `دریافت ${copy.plural} از سرور ناموفق بود.` } : undefined}
        emptyTitle={copy.empty}
        emptyDescription="فیلترها را تغییر دهید یا مورد جدیدی بسازید."
        compact
      />
    </div>
  );
}

export function ReferenceManagementView({
  brands,
  countries,
  brandsFailed,
  countriesFailed,
  canWrite,
}: ReferenceManagementViewProps) {
  const [kind, setKind] = useState<ReferenceKind>('brand');
  return (
    <div className="mt-6 space-y-5">
      <div
        role="tablist"
        aria-label="نوع اطلاعات پایه کاتالوگ"
        className="grid grid-cols-2 gap-1 rounded-[var(--admin-radius-lg)] bg-[var(--admin-color-surface-subtle)] p-1 sm:inline-grid sm:min-w-80"
      >
        {(['brand', 'country'] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={kind === value}
            onClick={() => setKind(value)}
            className={`min-h-10 rounded-[var(--admin-radius-md)] px-4 text-sm font-bold transition ${kind === value ? 'bg-[var(--admin-color-surface)] text-[var(--admin-color-ink)] shadow-sm' : 'text-[var(--admin-color-muted)]'}`}
          >
            {COPY[value].plural}
            <span className="ms-2 text-xs">
              {formatAdminInteger(value === 'brand' ? brands.length : countries.length)}
            </span>
          </button>
        ))}
      </div>
      {kind === 'brand' ? (
        <ReferencePanel kind="brand" items={brands} failed={brandsFailed} canWrite={canWrite} />
      ) : (
        <ReferencePanel
          kind="country"
          items={countries}
          failed={countriesFailed}
          canWrite={canWrite}
        />
      )}
    </div>
  );
}
