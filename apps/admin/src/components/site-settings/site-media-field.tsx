'use client';

import Image from 'next/image';
import { type ChangeEvent, useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import type { SiteMedia } from '@/lib/site-settings/site-settings-model';

const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);
const MAX_BYTES = 10 * 1024 * 1024;

function responseMessage(payload: unknown): string {
  if (typeof payload === 'object' && payload !== null) {
    const message = (payload as Record<string, unknown>).message;
    if (typeof message === 'string') return message;
    if (Array.isArray(message)) return message.join('، ');
  }
  return 'آپلود تصویر انجام نشد.';
}

export function SiteMediaField({
  label,
  media,
  altText,
  disabled = false,
  onUploaded,
  onClear,
}: Readonly<{
  label: string;
  media: SiteMedia | null;
  altText: string;
  disabled?: boolean;
  onUploaded: (media: SiteMedia) => void;
  onClear?: () => void;
}>) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    if (!ACCEPTED_TYPES.has(file.type) || file.size > MAX_BYTES) {
      setError('تصویر باید JPEG، PNG، WebP یا AVIF و حداکثر ۱۰ مگابایت باشد.');
      return;
    }
    const body = new FormData();
    body.set('file', file);
    body.set('altText', altText.trim() || label);
    setPending(true);
    setError(null);
    try {
      const response = await fetch('/api/site-settings/media', { method: 'POST', body });
      const payload = (await response.json().catch(() => null)) as unknown;
      if (!response.ok) throw new Error(responseMessage(payload));
      const source = payload as Partial<SiteMedia> | null;
      if (!source?.id || !source.mimeType) throw new Error('پاسخ آپلود تصویر معتبر نیست.');
      onUploaded({
        id: source.id,
        url: typeof source.url === 'string' ? source.url : null,
        mimeType: source.mimeType,
        altText: typeof source.altText === 'string' ? source.altText : null,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : responseMessage(null));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="relative aspect-[16/7] overflow-hidden rounded-[var(--admin-radius-md)] border border-dashed border-[var(--admin-color-border-strong)] bg-[var(--admin-color-surface-subtle)]">
        {media?.url ? (
          <Image
            src={media.url}
            alt={media.altText ?? ''}
            fill
            unoptimized
            sizes="(min-width: 1024px) 34vw, 100vw"
            className="object-cover"
          />
        ) : (
          <div className="grid h-full place-items-center p-6 text-center text-xs text-[var(--admin-color-muted)]">برای {label} تصویر بارگذاری کنید.</div>
        )}
      </div>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <div className="flex flex-wrap gap-2">
        <label className="inline-flex min-h-9 cursor-pointer items-center justify-center rounded-[var(--admin-radius-md)] border border-[var(--admin-color-border)] bg-white px-3 text-xs font-semibold hover:border-[var(--admin-color-border-strong)]">
          {pending ? 'در حال آپلود…' : media ? 'جایگزینی تصویر' : 'انتخاب تصویر'}
          <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" disabled={disabled || pending} onChange={(event) => void upload(event)} className="sr-only" />
        </label>
        {media && onClear ? <Button variant="ghost" size="sm" disabled={disabled || pending} onClick={onClear}>حذف تصویر</Button> : null}
      </div>
    </div>
  );
}
