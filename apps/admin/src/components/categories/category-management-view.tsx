'use client';

/* eslint-disable @next/next/no-img-element -- media host is configured at runtime on the API/VPS. */
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
import type { AdminCategory } from '@/lib/catalog/catalog-model';
import {
  formatAdminDateTime,
  formatAdminInteger,
  toAsciiDigits,
  toPersianDigits,
} from '@/lib/presentation/formatters';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);

type CategoryManagementViewProps = Readonly<{
  categories: readonly AdminCategory[];
  failed: boolean;
  canWrite: boolean;
}>;

function responseError(payload: unknown): string {
  const translations: Record<string, string> = {
    'A category with this slug already exists.': 'دسته‌بندی دیگری با این اسلاگ ثبت شده است.',
    'A category cannot be its own parent.': 'یک دسته نمی‌تواند والد خودش باشد.',
    'Category parent selection would create a cycle.':
      'انتخاب این والد در ساختار دسته‌بندی‌ها چرخه ایجاد می‌کند.',
    'A category with active children cannot be deactivated.':
      'تا وقتی این دسته فرزند فعال دارد، غیرفعال‌سازی آن ممکن نیست.',
    'A category with child categories cannot be archived.':
      'دسته‌ای که زیرمجموعه دارد قابل آرشیو نیست.',
    'A category assigned to products cannot be archived.':
      'دسته‌ای که به محصول متصل است قابل آرشیو نیست.',
    'Parent category was not found or is inactive.': 'دسته والد پیدا نشد یا غیرفعال است.',
    'Category was not found.': 'دسته‌بندی پیدا نشد.',
  };
  if (typeof payload === 'object' && payload !== null) {
    const value = payload as Record<string, unknown>;
    if (typeof value.message === 'string') return translations[value.message] ?? value.message;
    if (Array.isArray(value.message)) return value.message.join('، ');
    const nested = value.error as Record<string, unknown> | undefined;
    if (typeof nested?.message === 'string') return translations[nested.message] ?? nested.message;
  }
  return 'عملیات دسته‌بندی انجام نشد. دوباره تلاش کنید.';
}

function normalizeInteger(value: FormDataEntryValue | null): number | null {
  const normalized = toAsciiDigits(String(value ?? '')).replace(/[٬,\s]/g, '');
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function localizeInteger(event: InputEvent<HTMLInputElement>) {
  event.currentTarget.value = toPersianDigits(toAsciiDigits(event.currentTarget.value));
}

function categoryStatus(category: AdminCategory) {
  return (
    <Badge tone={category.active ? 'success' : 'neutral'} dot>
      {category.active ? 'فعال' : 'غیرفعال'}
    </Badge>
  );
}

function CategoryIdentity({ category }: Readonly<{ category: AdminCategory }>) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-[var(--admin-radius-md)] bg-[var(--admin-color-primary-soft)] font-black text-[var(--admin-color-primary)]">
        {category.image ? (
          <img
            src={category.image.url}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          category.name.slice(0, 1)
        )}
      </span>
      <span className="min-w-0">
        <span className="block truncate font-bold">{category.name}</span>
        <span dir="ltr" className="mt-0.5 block truncate text-xs text-[var(--admin-color-subtle)]">
          {toPersianDigits(category.slug)}
        </span>
      </span>
    </div>
  );
}

function descendantIds(categories: readonly AdminCategory[], categoryId: string): Set<string> {
  const result = new Set<string>();
  const pending = [categoryId];
  while (pending.length) {
    const current = pending.pop();
    for (const category of categories) {
      if (category.parentId === current && !result.has(category.id)) {
        result.add(category.id);
        pending.push(category.id);
      }
    }
  }
  return result;
}

type CategoryFormProps = Readonly<{
  formId: string;
  category?: AdminCategory;
  categories: readonly AdminCategory[];
  onSaved: () => void;
  onPendingChange: (pending: boolean) => void;
}>;

function CategoryForm({
  formId,
  category,
  categories,
  onSaved,
  onPendingChange,
}: CategoryFormProps) {
  const router = useRouter();
  const fileInputId = useId();
  const [file, setFile] = useState<File | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [archiveConfirmation, setArchiveConfirmation] = useState(false);
  const blockedParents = category ? descendantIds(categories, category.id) : new Set<string>();
  if (category) blockedParents.add(category.id);
  const parentOptions = categories
    .filter(
      (item) =>
        !blockedParents.has(item.id) &&
        (item.active || (category?.parentId !== null && item.id === category?.parentId)),
    )
    .map((item) => ({
      value: item.id,
      label: item.name,
      disabled: !item.active,
    }));
  const archiveBlocked = Boolean(
    category && (category.childCount > 0 || category.productCount > 0),
  );

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

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const name = String(formData.get('name') ?? '').trim();
    const slug = String(formData.get('slug') ?? '').trim();
    const description = String(formData.get('description') ?? '').trim();
    const parentId = String(formData.get('parentId') ?? 'root');
    const sortOrder = normalizeInteger(formData.get('sortOrder'));
    if (!name || !slug) return setError('نام و اسلاگ دسته‌بندی الزامی هستند.');
    if (sortOrder === null) return setError('ترتیب نمایش باید عدد صحیح صفر یا بزرگ‌تر باشد.');
    if (file && (!ACCEPTED_IMAGE_TYPES.has(file.type) || file.size > MAX_IMAGE_BYTES)) {
      return setError('تصویر باید JPEG، PNG، WebP یا AVIF و حداکثر ۱۰ مگابایت باشد.');
    }

    setError(null);
    onPendingChange(true);
    let categorySaved = false;
    try {
      const payload = await requestJson(
        category ? `/api/catalog/categories/${category.id}` : '/api/catalog/categories',
        category ? 'PATCH' : 'POST',
        {
          name,
          slug,
          description: description || null,
          parentId: parentId === 'root' ? null : parentId,
          sortOrder,
          isActive: formData.get('isActive') === 'on',
        },
      );
      const payloadRecord =
        typeof payload === 'object' && payload !== null
          ? (payload as Record<string, unknown>)
          : null;
      const savedCategoryId =
        category?.id ?? (typeof payloadRecord?.id === 'string' ? payloadRecord.id : null);
      if (!savedCategoryId) throw new Error('شناسه دسته‌بندی جدید از سرور دریافت نشد.');
      categorySaved = true;

      if (file) {
        const imageData = new FormData();
        imageData.set('file', file);
        imageData.set('altText', name);
        const imageResponse = await fetch(`/api/catalog/categories/${savedCategoryId}/image`, {
          method: 'POST',
          body: imageData,
        });
        const imagePayload = (await imageResponse.json().catch(() => null)) as unknown;
        if (!imageResponse.ok) throw new Error(responseError(imagePayload));
      } else if (category?.image && removeImage) {
        await requestJson(`/api/catalog/categories/${category.id}/image`, 'DELETE');
      }

      onSaved();
      router.refresh();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : responseError(null);
      setError(
        categorySaved ? `اطلاعات ذخیره شد؛ اما عملیات تصویر ناموفق بود: ${message}` : message,
      );
      if (categorySaved) router.refresh();
    } finally {
      onPendingChange(false);
    }
  }

  async function archive() {
    if (!category || archiveBlocked || !archiveConfirmation) return;
    setError(null);
    onPendingChange(true);
    try {
      await requestJson(`/api/catalog/categories/${category.id}`, 'DELETE');
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
        <Alert tone="danger" title="عملیات دسته‌بندی ناموفق بود">
          {error}
        </Alert>
      ) : null}

      {category ? (
        <dl className="grid grid-cols-3 gap-2 rounded-[var(--admin-radius-md)] bg-[var(--admin-color-surface-subtle)] p-3 text-center">
          <div>
            <dt className="text-[0.6875rem] text-[var(--admin-color-muted)]">محصول</dt>
            <dd className="mt-1 text-sm font-black">{formatAdminInteger(category.productCount)}</dd>
          </div>
          <div>
            <dt className="text-[0.6875rem] text-[var(--admin-color-muted)]">زیرمجموعه</dt>
            <dd className="mt-1 text-sm font-black">{formatAdminInteger(category.childCount)}</dd>
          </div>
          <div>
            <dt className="text-[0.6875rem] text-[var(--admin-color-muted)]">آخرین ویرایش</dt>
            <dd className="mt-1 text-xs font-bold">{formatAdminDateTime(category.updatedAt)}</dd>
          </div>
        </dl>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id={`${formId}-name`} label="نام دسته‌بندی" required>
          {(props) => (
            <Input
              {...props}
              name="name"
              defaultValue={category?.name}
              placeholder="مثلاً انگشتر نقره"
              maxLength={150}
              required
            />
          )}
        </FormField>
        <FormField id={`${formId}-slug`} label="اسلاگ" required>
          {(props) => (
            <Input
              {...props}
              name="slug"
              defaultValue={category?.slug}
              placeholder="silver-rings"
              dir="ltr"
              maxLength={180}
              required
            />
          )}
        </FormField>
        <FormField id={`${formId}-parent`} label="دسته والد">
          {(props) => (
            <Select
              {...props}
              name="parentId"
              defaultValue={category?.parentId ?? 'root'}
              options={[{ value: 'root', label: 'دسته اصلی' }, ...parentOptions]}
            />
          )}
        </FormField>
        <FormField id={`${formId}-order`} label="ترتیب نمایش" required>
          {(props) => (
            <Input
              {...props}
              name="sortOrder"
              defaultValue={toPersianDigits(category?.sortOrder ?? 0)}
              placeholder="مثلاً ۱"
              inputMode="numeric"
              onInput={localizeInteger}
              required
            />
          )}
        </FormField>
      </div>

      <FormField id={`${formId}-description`} label="توضیحات">
        {(props) => (
          <Textarea
            {...props}
            name="description"
            defaultValue={category?.description ?? ''}
            placeholder="توضیح کوتاه درباره محصولات این دسته"
          />
        )}
      </FormField>

      <section className="rounded-[var(--admin-radius-md)] border border-[var(--admin-color-border)] p-3">
        <div className="flex items-center gap-3">
          {category?.image && !removeImage && !file ? (
            <img
              src={category.image.url}
              alt={category.image.altText ?? category.name}
              className="size-16 rounded-[var(--admin-radius-md)] object-cover"
            />
          ) : (
            <span className="grid size-16 place-items-center rounded-[var(--admin-radius-md)] bg-[var(--admin-color-surface-subtle)] text-xs text-[var(--admin-color-muted)]">
              بدون تصویر
            </span>
          )}
          <div className="min-w-0 flex-1">
            <label htmlFor={fileInputId} className="text-sm font-bold">
              تصویر دسته‌بندی
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
            انتخاب تصویر
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
          {category?.image && !file ? (
            <Button size="sm" variant="ghost" onClick={() => setRemoveImage((current) => !current)}>
              {removeImage ? 'لغو حذف تصویر' : 'حذف تصویر فعلی'}
            </Button>
          ) : null}
        </div>
      </section>

      <Checkbox
        id={`${formId}-active`}
        name="isActive"
        label="دسته‌بندی فعال باشد"
        description="دسته غیرفعال در کاتالوگ عمومی نمایش داده نمی‌شود."
        defaultChecked={category?.active ?? true}
      />

      {category ? (
        <section className="border-t border-[var(--admin-color-border)] pt-4">
          {archiveBlocked ? (
            <Alert tone="warning">
              برای آرشیو، ابتدا {category.childCount > 0 ? 'زیرمجموعه‌ها' : 'محصولات متصل'} را منتقل
              کنید.
            </Alert>
          ) : archiveConfirmation ? (
            <Alert
              tone="danger"
              title="آرشیو این دسته‌بندی؟"
              action={
                <Button size="sm" variant="danger" onClick={() => void archive()}>
                  تأیید آرشیو
                </Button>
              }
            >
              این دسته از فهرست مدیریت فعال حذف می‌شود.
            </Alert>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setArchiveConfirmation(true)}>
              آرشیو دسته‌بندی
            </Button>
          )}
        </section>
      ) : null}
    </form>
  );
}

function CategorySheet({
  category,
  categories,
  triggerLabel,
}: Readonly<{
  category?: AdminCategory;
  categories: readonly AdminCategory[];
  triggerLabel: string;
}>) {
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  return (
    <BottomSheet open={open} onOpenChange={setOpen}>
      <BottomSheetTrigger asChild>
        <Button size="sm" variant={category ? 'outline' : 'primary'}>
          {triggerLabel}
        </Button>
      </BottomSheetTrigger>
      <BottomSheetContent
        title={category ? `ویرایش ${category.name}` : 'افزودن دسته‌بندی'}
        description="ساختار، وضعیت، ترتیب و تصویر دسته را تنظیم کنید."
        height="large"
        footer={
          <>
            <Button variant="outline" disabled={pending} onClick={() => setOpen(false)}>
              انصراف
            </Button>
            <Button type="submit" form={formId} loading={pending}>
              ذخیره دسته‌بندی
            </Button>
          </>
        }
      >
        <CategoryForm
          formId={formId}
          category={category}
          categories={categories}
          onSaved={() => setOpen(false)}
          onPendingChange={setPending}
        />
      </BottomSheetContent>
    </BottomSheet>
  );
}

function ReadonlyCategoryDetails({ category }: Readonly<{ category: AdminCategory }>) {
  return (
    <dl className="divide-y divide-[var(--admin-color-border)]">
      {[
        ['نام', category.name],
        ['وضعیت', category.active ? 'فعال' : 'غیرفعال'],
        ['اسلاگ', toPersianDigits(category.slug)],
        ['والد', category.parent?.name ?? 'دسته اصلی'],
        ['ترتیب', formatAdminInteger(category.sortOrder)],
        ['زیرمجموعه', formatAdminInteger(category.childCount)],
        ['محصول', formatAdminInteger(category.productCount)],
        ['توضیحات', category.description ?? 'ثبت نشده'],
        ['تصویر', category.image ? 'ثبت شده' : 'ثبت نشده'],
        ['آخرین ویرایش', formatAdminDateTime(category.updatedAt)],
      ].map(([label, value]) => (
        <div key={label} className="flex justify-between gap-4 py-3 text-sm">
          <dt className="text-[var(--admin-color-muted)]">{label}</dt>
          <dd className="max-w-[65%] text-left font-semibold">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function CategoryMobileCard({
  category,
  categories,
  canWrite,
}: Readonly<{
  category: AdminCategory;
  categories: readonly AdminCategory[];
  canWrite: boolean;
}>) {
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  return (
    <MobileDataCard
      eyebrow={category.parent?.name ?? 'دسته اصلی'}
      title={category.name}
      status={categoryStatus(category)}
      items={[
        { label: 'محصول', value: formatAdminInteger(category.productCount) },
        { label: 'زیرمجموعه', value: formatAdminInteger(category.childCount) },
        { label: 'ترتیب', value: formatAdminInteger(category.sortOrder) },
      ]}
      detailsTitle={category.name}
      detailsDescription="جزئیات کامل دسته‌بندی و عملیات"
      detailsOpen={open}
      onDetailsOpenChange={setOpen}
      details={
        canWrite ? (
          <CategoryForm
            formId={formId}
            category={category}
            categories={categories}
            onSaved={() => setOpen(false)}
            onPendingChange={setPending}
          />
        ) : (
          <ReadonlyCategoryDetails category={category} />
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

export function CategoryManagementView({
  categories,
  failed,
  canWrite,
}: CategoryManagementViewProps) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [parent, setParent] = useState('all');
  const normalizedQuery = query.trim().toLocaleLowerCase('fa');
  const filtered = useMemo(
    () =>
      categories.filter((category) => {
        const matchesQuery =
          !normalizedQuery ||
          category.name.toLocaleLowerCase('fa').includes(normalizedQuery) ||
          category.slug.toLocaleLowerCase('en').includes(normalizedQuery);
        const matchesStatus =
          status === 'all' || (status === 'active' ? category.active : !category.active);
        const matchesParent =
          parent === 'all' ||
          (parent === 'root' ? category.parentId === null : category.parentId === parent);
        return matchesQuery && matchesStatus && matchesParent;
      }),
    [categories, normalizedQuery, parent, status],
  );
  const activeFilterCount = [
    normalizedQuery,
    status === 'all' ? '' : status,
    parent === 'all' ? '' : parent,
  ].filter(Boolean).length;
  const columns: readonly DataTableColumn<AdminCategory>[] = [
    {
      id: 'category',
      header: 'دسته‌بندی',
      cell: (category) => <CategoryIdentity category={category} />,
    },
    { id: 'parent', header: 'والد', cell: (category) => category.parent?.name ?? 'دسته اصلی' },
    {
      id: 'products',
      header: 'محصول',
      cell: (category) => formatAdminInteger(category.productCount),
      align: 'center',
    },
    {
      id: 'children',
      header: 'زیرمجموعه',
      cell: (category) => formatAdminInteger(category.childCount),
      align: 'center',
    },
    {
      id: 'order',
      header: 'ترتیب',
      cell: (category) => formatAdminInteger(category.sortOrder),
      align: 'center',
    },
    { id: 'status', header: 'وضعیت', cell: categoryStatus },
    {
      id: 'actions',
      header: 'عملیات',
      align: 'end',
      cell: (category) =>
        canWrite ? (
          <CategorySheet category={category} categories={categories} triggerLabel="ویرایش" />
        ) : (
          <span className="text-xs text-[var(--admin-color-subtle)]">فقط مشاهده</span>
        ),
    },
  ];

  return (
    <div className="mt-6 space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ['کل دسته‌ها', categories.length],
          ['دسته فعال', categories.filter((item) => item.active).length],
          ['دسته اصلی', categories.filter((item) => item.parentId === null).length],
          ['متصل به محصول', categories.filter((item) => item.productCount > 0).length],
        ].map(([label, value]) => (
          <Card key={String(label)} className="p-0">
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
                setParent('all');
              }}
            >
              پاک‌کردن فیلترها
            </Button>
          ) : undefined
        }
        actions={
          canWrite ? <CategorySheet categories={categories} triggerLabel="افزودن دسته" /> : null
        }
      >
        <SearchField
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="جستجو در نام یا اسلاگ"
          aria-label="جستجوی دسته‌بندی"
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
        <Select
          value={parent}
          onValueChange={setParent}
          aria-label="فیلتر دسته والد"
          options={[
            { value: 'all', label: 'همه دسته‌های والد' },
            { value: 'root', label: 'فقط دسته‌های اصلی' },
            ...categories
              .filter((item) => item.childCount > 0)
              .map((item) => ({ value: item.id, label: item.name })),
          ]}
        />
      </FilterBar>

      <ResponsiveDataView
        mobileLabel="کارت‌های دسته‌بندی"
        renderMobileCard={(category) => (
          <CategoryMobileCard category={category} categories={categories} canWrite={canWrite} />
        )}
        caption="جدول دسته‌بندی‌های فروشگاه"
        columns={columns}
        rows={filtered}
        getRowKey={(category) => category.id}
        error={failed ? { description: 'دریافت دسته‌بندی‌ها از سرور ناموفق بود.' } : undefined}
        emptyTitle="دسته‌بندی پیدا نشد"
        emptyDescription="فیلترها را تغییر دهید یا یک دسته جدید بسازید."
        compact
      />
    </div>
  );
}
