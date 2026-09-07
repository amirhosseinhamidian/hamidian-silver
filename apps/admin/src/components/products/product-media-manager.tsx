'use client';

/* eslint-disable @next/next/no-img-element -- media host is runtime-configured on the API/VPS. */
import { useRouter } from 'next/navigation';
import { type FormEvent, useId, useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { BottomSheet, BottomSheetContent, BottomSheetTrigger } from '@/components/ui/bottom-sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/form-control';
import { FormField } from '@/components/ui/form-field';
import type { AdminProductMedia } from '@/lib/catalog/catalog-model';
import { formatAdminInteger, toPersianDigits } from '@/lib/presentation/formatters';

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_PRODUCT_IMAGES = 12;
const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);

type ProductMediaManagerProps = Readonly<{
  productId: string;
  productName: string;
  media: readonly AdminProductMedia[];
}>;

function responseError(payload: unknown): string {
  if (typeof payload === 'object' && payload !== null) {
    const value = payload as Record<string, unknown>;
    if (typeof value.message === 'string') return value.message;
    const nested = value.error as Record<string, unknown> | undefined;
    if (typeof nested?.message === 'string') return nested.message;
  }
  return 'عملیات تصویر انجام نشد. دوباره تلاش کنید.';
}

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${toPersianDigits((bytes / (1024 * 1024)).toFixed(1)).replace('.', '٫')} مگابایت`;
  }
  return `${formatAdminInteger(Math.ceil(bytes / 1024))} کیلوبایت`;
}

function MediaPreview({
  item,
  productName,
}: Readonly<{ item: AdminProductMedia; productName: string }>) {
  return item.url ? (
    <img
      src={item.url}
      alt={item.altText ?? `تصویر ${productName}`}
      className="h-full w-full object-cover"
      loading="lazy"
    />
  ) : (
    <div className="grid h-full place-items-center bg-[var(--admin-color-surface-subtle)] px-3 text-center text-xs text-[var(--admin-color-muted)]">
      پیش‌نمایش در دسترس نیست
    </div>
  );
}

export function ProductMediaManager({ productId, productName, media }: ProductMediaManagerProps) {
  const router = useRouter();
  const inputId = useId();
  const [files, setFiles] = useState<readonly File[]>([]);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const remainingSlots = Math.max(0, MAX_PRODUCT_IMAGES - media.length);

  async function jsonMutation(path: string, method: 'PATCH' | 'DELETE', body?: unknown) {
    const response = await fetch(path, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const payload = (await response.json().catch(() => null)) as unknown;
    if (!response.ok) throw new Error(responseError(payload));
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    if (files.length === 0) return setError('حداقل یک تصویر انتخاب کنید.');
    if (files.length > remainingSlots) {
      return setError(
        `حداکثر ${formatAdminInteger(MAX_PRODUCT_IMAGES)} تصویر برای هر محصول مجاز است.`,
      );
    }
    const invalid = files.find(
      (file) => !ACCEPTED_TYPES.has(file.type) || file.size > MAX_FILE_BYTES,
    );
    if (invalid) {
      return setError('هر فایل باید JPEG، PNG، WebP یا AVIF و حداکثر ۱۰ مگابایت باشد.');
    }

    const form = new FormData(event.currentTarget);
    const altText = String(form.get('uploadAltText') ?? '').trim() || productName;
    setPending('upload');
    setError(null);
    let uploadedCount = 0;
    try {
      for (const file of files) {
        const body = new FormData();
        body.set('file', file);
        body.set('altText', altText);
        const response = await fetch(`/api/catalog/products/${productId}/media`, {
          method: 'POST',
          body,
        });
        const payload = (await response.json().catch(() => null)) as unknown;
        if (!response.ok) throw new Error(responseError(payload));
        uploadedCount += 1;
      }
      setFiles([]);
      formElement.reset();
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : responseError(null));
      if (uploadedCount > 0) router.refresh();
    } finally {
      setPending(null);
    }
  }

  async function updateMedia(mediaId: string, body: unknown, operation: string) {
    setPending(operation);
    setError(null);
    try {
      await jsonMutation(`/api/catalog/products/${productId}/media/${mediaId}`, 'PATCH', body);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : responseError(null));
    } finally {
      setPending(null);
    }
  }

  async function saveAltText(event: FormEvent<HTMLFormElement>, mediaId: string) {
    event.preventDefault();
    const altText = String(new FormData(event.currentTarget).get('altText') ?? '').trim();
    await updateMedia(mediaId, { altText: altText || null }, `alt-${mediaId}`);
  }

  async function move(mediaId: string, offset: -1 | 1) {
    const index = media.findIndex((item) => item.id === mediaId);
    const target = index + offset;
    if (index < 0 || target < 0 || target >= media.length) return;
    const mediaIds = media.map((item) => item.id);
    [mediaIds[index], mediaIds[target]] = [mediaIds[target], mediaIds[index]];

    setPending(`order-${mediaId}`);
    setError(null);
    try {
      await jsonMutation(`/api/catalog/products/${productId}/media`, 'PATCH', { mediaIds });
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : responseError(null));
    } finally {
      setPending(null);
    }
  }

  async function remove(item: AdminProductMedia) {
    if (!window.confirm('این تصویر از محصول حذف شود؟')) return;
    setPending(`remove-${item.id}`);
    setError(null);
    try {
      await jsonMutation(`/api/catalog/products/${productId}/media/${item.id}`, 'DELETE');
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : responseError(null));
    } finally {
      setPending(null);
    }
  }

  return (
    <Card
      title="تصاویر محصول"
      description={`حداکثر ${formatAdminInteger(MAX_PRODUCT_IMAGES)} تصویر؛ اولین تصویر بدون انتخاب دستی، تصویر اصلی می‌شود.`}
      action={
        remainingSlots > 0 ? (
          <BottomSheet>
            <BottomSheetTrigger asChild>
              <Button size="sm">افزودن تصویر</Button>
            </BottomSheetTrigger>
            <BottomSheetContent
              title="بارگذاری تصاویر"
              description="فایل‌ها روی دیسک سرور ذخیره می‌شوند و فضای خارجی استفاده نمی‌شود."
            >
              <form onSubmit={(event) => void upload(event)} className="space-y-4">
                <label
                  htmlFor={inputId}
                  className="grid min-h-32 cursor-pointer place-items-center rounded-[var(--admin-radius-lg)] border border-dashed border-[var(--admin-color-border-strong)] bg-[var(--admin-color-surface-subtle)] p-5 text-center outline-none focus-within:shadow-[var(--admin-focus-ring)]"
                >
                  <span>
                    <strong className="block text-sm">انتخاب تصویر از دستگاه</strong>
                    <span className="mt-2 block text-xs leading-5 text-[var(--admin-color-muted)]">
                      JPEG، PNG، WebP یا AVIF؛ هر فایل حداکثر ۱۰ مگابایت
                    </span>
                    {files.length > 0 ? (
                      <Badge tone="info" className="mt-3">
                        {formatAdminInteger(files.length)} فایل انتخاب شد
                      </Badge>
                    ) : null}
                  </span>
                  <input
                    id={inputId}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/avif"
                    multiple
                    className="sr-only"
                    onChange={(event) => setFiles(Array.from(event.currentTarget.files ?? []))}
                  />
                </label>
                <FormField
                  id={`${inputId}-alt`}
                  label="متن جایگزین اولیه"
                  hint="بعداً برای هر تصویر جداگانه قابل ویرایش است."
                >
                  {(props) => (
                    <Input
                      {...props}
                      name="uploadAltText"
                      defaultValue={productName}
                      placeholder="توضیح کوتاه و دقیق تصویر"
                    />
                  )}
                </FormField>
                <Button type="submit" loading={pending === 'upload'} className="w-full">
                  بارگذاری {files.length ? formatAdminInteger(files.length) : ''} تصویر
                </Button>
              </form>
            </BottomSheetContent>
          </BottomSheet>
        ) : (
          <Badge tone="warning">ظرفیت تکمیل است</Badge>
        )
      }
    >
      {error ? (
        <Alert tone="danger" className="mb-4">
          {error}
        </Alert>
      ) : null}

      {media.length === 0 ? (
        <div className="grid min-h-40 place-items-center rounded-[var(--admin-radius-lg)] border border-dashed border-[var(--admin-color-border)] bg-[var(--admin-color-surface-subtle)] p-5 text-center">
          <div>
            <p className="text-sm font-bold">هنوز تصویری ثبت نشده است</p>
            <p className="mt-2 text-xs text-[var(--admin-color-muted)]">
              برای نمایش بهتر محصول، حداقل یک تصویر واضح اضافه کنید.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {media.map((item, index) => (
            <article
              key={item.id}
              className="overflow-hidden rounded-[var(--admin-radius-lg)] border border-[var(--admin-color-border)] bg-[var(--admin-color-surface)]"
            >
              <div className="relative aspect-square overflow-hidden bg-[var(--admin-color-surface-subtle)]">
                <MediaPreview item={item} productName={productName} />
                <div className="absolute inset-x-2 top-2 flex items-center justify-between gap-2">
                  <Badge tone="neutral">{formatAdminInteger(index + 1)}</Badge>
                  {item.isPrimary ? <Badge tone="success">تصویر اصلی</Badge> : null}
                </div>
              </div>
              <div className="p-2.5">
                <p className="truncate text-xs font-semibold">
                  {item.altText ?? 'بدون متن جایگزین'}
                </p>
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={index === 0 || pending !== null}
                    onClick={() => void move(item.id, -1)}
                  >
                    قبلی
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={index === media.length - 1 || pending !== null}
                    onClick={() => void move(item.id, 1)}
                  >
                    بعدی
                  </Button>
                </div>
                <BottomSheet>
                  <BottomSheetTrigger asChild>
                    <Button size="sm" variant="ghost" className="mt-1.5 w-full">
                      جزئیات و ویرایش
                    </Button>
                  </BottomSheetTrigger>
                  <BottomSheetContent
                    title={`تصویر ${formatAdminInteger(index + 1)}`}
                    description={
                      item.isPrimary ? 'تصویر اصلی محصول' : 'ویرایش مشخصات و جایگاه تصویر'
                    }
                    height="large"
                  >
                    <div className="mx-auto aspect-square max-w-sm overflow-hidden rounded-[var(--admin-radius-lg)] border border-[var(--admin-color-border)]">
                      <MediaPreview item={item} productName={productName} />
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-[var(--admin-color-muted)]">
                      <div>
                        <dt>حجم فایل</dt>
                        <dd className="mt-1 font-bold text-[var(--admin-color-ink)]">
                          {formatFileSize(item.sizeBytes)}
                        </dd>
                      </div>
                      <div>
                        <dt>فرمت</dt>
                        <dd className="mt-1 font-bold text-[var(--admin-color-ink)]" dir="ltr">
                          {item.mimeType}
                        </dd>
                      </div>
                    </dl>
                    <form
                      onSubmit={(event) => void saveAltText(event, item.id)}
                      className="mt-5 space-y-3"
                    >
                      <FormField
                        id={`alt-${item.id}`}
                        label="متن جایگزین"
                        hint="تصویر را برای دسترس‌پذیری و موتور جستجو توصیف کنید."
                      >
                        {(props) => (
                          <Input
                            {...props}
                            name="altText"
                            defaultValue={item.altText ?? ''}
                            placeholder={`تصویر ${productName}`}
                          />
                        )}
                      </FormField>
                      <Button
                        type="submit"
                        variant="outline"
                        loading={pending === `alt-${item.id}`}
                        className="w-full"
                      >
                        ذخیره متن جایگزین
                      </Button>
                    </form>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <Button
                        variant="secondary"
                        disabled={item.isPrimary || pending !== null}
                        onClick={() =>
                          void updateMedia(item.id, { isPrimary: true }, `primary-${item.id}`)
                        }
                      >
                        انتخاب به‌عنوان اصلی
                      </Button>
                      <Button
                        variant="danger"
                        loading={pending === `remove-${item.id}`}
                        disabled={pending !== null}
                        onClick={() => void remove(item)}
                      >
                        حذف از محصول
                      </Button>
                    </div>
                  </BottomSheetContent>
                </BottomSheet>
              </div>
            </article>
          ))}
        </div>
      )}
    </Card>
  );
}
