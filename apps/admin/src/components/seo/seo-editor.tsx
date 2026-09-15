'use client';

import { SiteMediaField } from '@/components/site-settings/site-media-field';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input, Textarea } from '@/components/ui/form-control';
import { FormField } from '@/components/ui/form-field';
import { toPersianDigits } from '@/lib/presentation/formatters';
import type { SiteMedia } from '@/lib/site-settings/site-settings-model';

export type SeoEditorValue = Readonly<{
  title: string;
  description: string;
  canonicalPath: string;
  noIndex: boolean;
  ogMediaId: string | null;
  ogMedia: SiteMedia | null;
}>;

type SeoSource = Readonly<{
  seoTitle?: string | null;
  seoDescription?: string | null;
  seoCanonicalPath?: string | null;
  seoNoIndex?: boolean;
  seoOgMediaId?: string | null;
  seoOgMedia?: SiteMedia | null;
}>;

export function createSeoEditorValue(source?: SeoSource | null): SeoEditorValue {
  return {
    title: source?.seoTitle ?? '',
    description: source?.seoDescription ?? '',
    canonicalPath: source?.seoCanonicalPath ?? '',
    noIndex: source?.seoNoIndex ?? false,
    ogMediaId: source?.seoOgMediaId ?? null,
    ogMedia: source?.seoOgMedia ?? null,
  };
}

export function isValidSeoCanonicalPath(value: string): boolean {
  return value === '' || /^\/(?!\/)[^\s?#]*$/.test(value);
}

export function seoEditorPayload(value: SeoEditorValue) {
  return {
    seoTitle: value.title.trim() || null,
    seoDescription: value.description.trim() || null,
    seoCanonicalPath: value.canonicalPath.trim() || null,
    seoNoIndex: value.noIndex,
    seoOgMediaId: value.ogMediaId,
  };
}

export function SeoEditor({
  value,
  onChange,
  canonicalPlaceholder,
  defaultTitle,
  uploadUrl,
  idPrefix = 'seo',
  disabled = false,
}: Readonly<{
  value: SeoEditorValue;
  onChange: (value: SeoEditorValue) => void;
  canonicalPlaceholder: string;
  defaultTitle: string;
  uploadUrl: string;
  idPrefix?: string;
  disabled?: boolean;
}>) {
  return (
    <Card
      title="تنظیمات SEO"
      description="مقادیر خالی از سیاست پیش‌فرض سایت و محتوای همین صفحه تکمیل می‌شوند."
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(16rem,0.65fr)]">
        <div className="grid gap-4">
          <FormField
            id={`${idPrefix}-title`}
            label="عنوان SEO"
            hint={`${toPersianDigits(String(value.title.length))} از ۲۰۰ نویسه`}
          >
            {(props) => (
              <Input
                {...props}
                value={value.title}
                maxLength={200}
                placeholder={defaultTitle}
                disabled={disabled}
                onChange={(event) => onChange({ ...value, title: event.currentTarget.value })}
              />
            )}
          </FormField>
          <FormField
            id={`${idPrefix}-description`}
            label="توضیح SEO"
            hint={`${toPersianDigits(String(value.description.length))} از ۵۰۰ نویسه`}
          >
            {(props) => (
              <Textarea
                {...props}
                value={value.description}
                maxLength={500}
                placeholder="توضیح دقیق و کوتاه برای نتیجه جست‌وجو و اشتراک‌گذاری"
                disabled={disabled}
                onChange={(event) => onChange({ ...value, description: event.currentTarget.value })}
              />
            )}
          </FormField>
          <FormField
            id={`${idPrefix}-canonical-path`}
            label="مسیر canonical"
            hint="اختیاری؛ فقط مسیر داخلی، بدون دامنه، query یا fragment"
          >
            {(props) => (
              <Input
                {...props}
                dir="ltr"
                value={value.canonicalPath}
                maxLength={1000}
                aria-invalid={!isValidSeoCanonicalPath(value.canonicalPath.trim())}
                placeholder={canonicalPlaceholder}
                disabled={disabled}
                onChange={(event) =>
                  onChange({ ...value, canonicalPath: event.currentTarget.value })
                }
              />
            )}
          </FormField>
          <Checkbox
            id={`${idPrefix}-no-index`}
            label="جلوگیری از ایندکس این صفحه"
            description="فقط برای محتوای موقت، تکراری یا غیرفعال استفاده شود."
            checked={value.noIndex}
            disabled={disabled}
            onChange={(event) => onChange({ ...value, noIndex: event.currentTarget.checked })}
          />
        </div>
        <SiteMediaField
          label="تصویر Open Graph"
          media={value.ogMedia}
          altText={value.title.trim() || defaultTitle}
          uploadUrl={uploadUrl}
          disabled={disabled}
          onUploaded={(media) => onChange({ ...value, ogMediaId: media.id, ogMedia: media })}
          onClear={() => onChange({ ...value, ogMediaId: null, ogMedia: null })}
        />
      </div>
    </Card>
  );
}
