'use client';

import { useMemo, useState, type FormEvent } from 'react';

import { SiteMediaField } from '@/components/site-settings/site-media-field';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input, Textarea } from '@/components/ui/form-control';
import { FormField } from '@/components/ui/form-field';
import { Select } from '@/components/ui/select';
import {
  CONTENT_PAGE_KEYS,
  parseAdminContentPage,
  type AdminContentPage,
  type ContentPageKey,
  type ContentPageSection,
} from '@/lib/content-pages/content-pages-model';
import {
  formatAdminDateTime,
  formatAdminInteger,
  toPersianDigits,
} from '@/lib/presentation/formatters';
import type { SiteMedia } from '@/lib/site-settings/site-settings-model';
import { cn } from '@/lib/ui/cn';

type Props = Readonly<{
  pages: readonly AdminContentPage[];
  failed: boolean;
  canWrite: boolean;
}>;

type Draft = Readonly<{
  title: string;
  eyebrow: string;
  subtitle: string;
  body: string;
  heroMediaId: string | null;
  heroMedia: SiteMedia | null;
  seoTitle: string;
  seoDescription: string;
  sections: readonly ContentPageSection[];
}>;

const PAGE_PRESENTATION: Record<
  ContentPageKey,
  Readonly<{ label: string; href: string; group: 'brand' | 'guide' | 'legal' }>
> = {
  ABOUT: { label: 'درباره ما', href: '/about', group: 'brand' },
  CONTACT: { label: 'تماس با ما', href: '/contact', group: 'brand' },
  SERVICES: { label: 'خدمات', href: '/services', group: 'brand' },
  SIZE_GUIDE: { label: 'راهنمای سایز', href: '/size-guide', group: 'guide' },
  FAQ: { label: 'سؤالات متداول', href: '/faq', group: 'guide' },
  TERMS: { label: 'شرایط و قوانین', href: '/terms', group: 'legal' },
  PRIVACY: { label: 'حریم خصوصی', href: '/privacy', group: 'legal' },
};

const IMAGE_REQUIRED = new Set<ContentPageKey>(['ABOUT', 'CONTACT', 'SERVICES']);

function toDraft(page: AdminContentPage): Draft {
  return {
    title: page.title,
    eyebrow: page.eyebrow ?? '',
    subtitle: page.subtitle ?? '',
    body: page.body ?? '',
    heroMediaId: page.heroMediaId,
    heroMedia: page.heroMediaId
      ? {
          id: page.heroMediaId,
          url: page.heroMedia?.url ?? null,
          mimeType: 'image/*',
          altText: page.heroMedia?.altText ?? null,
        }
      : null,
    seoTitle: page.seoTitle ?? '',
    seoDescription: page.seoDescription ?? '',
    sections: page.sections.map((section) => ({ ...section })),
  };
}

function responseMessage(payload: unknown, fallback: string): string {
  if (typeof payload === 'object' && payload !== null) {
    const message = (payload as Record<string, unknown>).message;
    if (typeof message === 'string') return message;
    if (Array.isArray(message)) return message.join('، ');
  }
  return fallback;
}

function validateDraft(key: ContentPageKey, draft: Draft): string | null {
  if (!draft.title.trim()) return 'عنوان صفحه الزامی است.';
  if (draft.title.trim().length > 200) return 'عنوان صفحه حداکثر ۲۰۰ نویسه است.';
  if (draft.eyebrow.trim().length > 100) return 'بالانویس حداکثر ۱۰۰ نویسه است.';
  if (draft.subtitle.trim().length > 500) return 'زیرعنوان حداکثر ۵۰۰ نویسه است.';
  if (draft.body.trim().length > 20_000) return 'متن اصلی حداکثر ۲۰٬۰۰۰ نویسه است.';
  if (draft.seoTitle.trim().length > 200) return 'عنوان SEO حداکثر ۲۰۰ نویسه است.';
  if (draft.seoDescription.trim().length > 500) return 'توضیح SEO حداکثر ۵۰۰ نویسه است.';
  if (IMAGE_REQUIRED.has(key) && !draft.heroMediaId) return 'تصویر Hero برای این صفحه الزامی است.';
  if (draft.sections.length > 12) return 'هر صفحه حداکثر ۱۲ بخش محتوایی دارد.';
  if (draft.sections.some((section) => !section.title.trim()))
    return 'عنوان همه بخش‌ها الزامی است.';
  if (draft.sections.some((section) => section.title.trim().length > 200)) {
    return 'عنوان هر بخش حداکثر ۲۰۰ نویسه است.';
  }
  if (draft.sections.some((section) => (section.body?.trim().length ?? 0) > 5000)) {
    return 'متن هر بخش حداکثر ۵٬۰۰۰ نویسه است.';
  }
  return null;
}

function Kpi({
  label,
  value,
  tone,
}: Readonly<{ label: string; value: number; tone: 'neutral' | 'info' | 'success' | 'warning' }>) {
  return (
    <Card>
      <Badge tone={tone}>{label}</Badge>
      <p className="mt-3 text-2xl font-black tabular-nums">{formatAdminInteger(value)}</p>
    </Card>
  );
}

function SectionEditor({
  sections,
  disabled,
  onChange,
}: Readonly<{
  sections: readonly ContentPageSection[];
  disabled: boolean;
  onChange: (sections: readonly ContentPageSection[]) => void;
}>) {
  function update(index: number, next: Partial<ContentPageSection>) {
    onChange(
      sections.map((section, itemIndex) =>
        itemIndex === index ? { ...section, ...next } : section,
      ),
    );
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= sections.length) return;
    const next = [...sections];
    [next[index], next[target]] = [next[target]!, next[index]!];
    onChange(next);
  }

  return (
    <Card
      title="بخش‌های محتوا"
      description="ترتیب این بخش‌ها در Storefront حفظ می‌شود."
      action={
        <Button
          size="sm"
          variant="outline"
          disabled={disabled || sections.length >= 12}
          onClick={() => onChange([...sections, { title: '', body: null }])}
        >
          افزودن بخش
        </Button>
      }
    >
      {sections.length ? (
        <div className="space-y-3">
          {sections.map((section, index) => (
            <article
              key={index}
              className="rounded-[var(--admin-radius-md)] border border-[var(--admin-color-border)] p-3"
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <Badge tone="neutral">بخش {formatAdminInteger(index + 1)}</Badge>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={disabled || index === 0}
                    onClick={() => move(index, -1)}
                  >
                    بالاتر
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={disabled || index === sections.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    پایین‌تر
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={disabled}
                    onClick={() => onChange(sections.filter((_, itemIndex) => itemIndex !== index))}
                  >
                    حذف
                  </Button>
                </div>
              </div>
              <div className="grid gap-3">
                <FormField id={`content-section-${index}-title`} label="عنوان بخش" required>
                  {(controlProps) => (
                    <Input
                      {...controlProps}
                      value={section.title}
                      maxLength={200}
                      disabled={disabled}
                      onChange={(event) => update(index, { title: event.target.value })}
                    />
                  )}
                </FormField>
                <FormField id={`content-section-${index}-body`} label="متن بخش">
                  {(controlProps) => (
                    <Textarea
                      {...controlProps}
                      value={section.body ?? ''}
                      maxLength={5000}
                      disabled={disabled}
                      onChange={(event) => update(index, { body: event.target.value || null })}
                    />
                  )}
                </FormField>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="text-sm text-[var(--admin-color-muted)]">
          این صفحه بخش محتوایی جداگانه ندارد.
        </p>
      )}
    </Card>
  );
}

export function ContentPagesView({ pages: initialPages, failed, canWrite }: Props) {
  const [pages, setPages] = useState(initialPages);
  const [selectedKey, setSelectedKey] = useState<ContentPageKey>(initialPages[0]?.key ?? 'ABOUT');
  const selectedPage = pages.find((page) => page.key === selectedKey) ?? null;
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(initialPages.map((page) => [page.key, toDraft(page)])),
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const draft = drafts[selectedKey] ?? (selectedPage ? toDraft(selectedPage) : null);

  const totals = useMemo(
    () => ({
      pages: pages.length,
      images: pages.filter((page) => page.heroMediaId).length,
      seo: pages.filter((page) => page.seoTitle && page.seoDescription).length,
      sections: pages.reduce((sum, page) => sum + page.sections.length, 0),
    }),
    [pages],
  );

  function updateDraft(next: Partial<Draft>) {
    if (!draft) return;
    setDrafts((current) => ({ ...current, [selectedKey]: { ...draft, ...next } }));
    setSuccess(null);
  }

  function choosePage(key: ContentPageKey) {
    if (pending) return;
    setSelectedKey(key);
    setError(null);
    setSuccess(null);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft || !canWrite || pending) return;
    const validationError = validateDraft(selectedKey, draft);
    if (validationError) {
      setError(validationError);
      return;
    }
    setPending(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`/api/content-pages/${encodeURIComponent(selectedKey)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: draft.title.trim(),
          eyebrow: draft.eyebrow.trim() || null,
          subtitle: draft.subtitle.trim() || null,
          body: draft.body.trim() || null,
          heroMediaId: draft.heroMediaId,
          seoTitle: draft.seoTitle.trim() || null,
          seoDescription: draft.seoDescription.trim() || null,
          sections: draft.sections.map((section) => ({
            title: section.title.trim(),
            body: section.body?.trim() || null,
          })),
        }),
      });
      const payload = (await response.json().catch(() => null)) as unknown;
      if (!response.ok) throw new Error(responseMessage(payload, 'ذخیره محتوای صفحه انجام نشد.'));
      const updated = parseAdminContentPage(payload);
      if (!updated) throw new Error('پاسخ ذخیره صفحه معتبر نیست.');
      setPages((current) => current.map((page) => (page.key === updated.key ? updated : page)));
      setDrafts((current) => ({ ...current, [updated.key]: toDraft(updated) }));
      setSuccess(`محتوای صفحه «${PAGE_PRESENTATION[updated.key].label}» ذخیره شد.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'ذخیره محتوای صفحه انجام نشد.');
    } finally {
      setPending(false);
    }
  }

  if (failed || !selectedPage || !draft) {
    return (
      <Alert tone="danger" title="محتوای صفحات دریافت نشد">
        اتصال API و مجوز `cms.read` را بررسی و صفحه را تازه‌سازی کنید.
      </Alert>
    );
  }

  const pageMeta = PAGE_PRESENTATION[selectedKey];
  const previewBase = process.env.NEXT_PUBLIC_STOREFRONT_URL ?? '';

  return (
    <div className="space-y-6">
      {!canWrite ? (
        <Alert tone="info">
          دسترسی شما فقط برای مشاهده است؛ ویرایش محتوا به `cms.write` نیاز دارد.
        </Alert>
      ) : null}
      {success ? <Alert tone="success">{success}</Alert> : null}
      {error ? <Alert tone="danger">{error}</Alert> : null}

      <section aria-label="شاخص‌های محتوای صفحات" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="صفحه مدیریت‌شده" value={totals.pages} tone="info" />
        <Kpi
          label="دارای تصویر Hero"
          value={totals.images}
          tone={totals.images >= 3 ? 'success' : 'warning'}
        />
        <Kpi
          label="SEO کامل"
          value={totals.seo}
          tone={totals.seo === totals.pages ? 'success' : 'warning'}
        />
        <Kpi label="بخش محتوایی" value={totals.sections} tone="neutral" />
      </section>

      <div className="lg:hidden">
        <Select
          aria-label="انتخاب صفحه محتوا"
          value={selectedKey}
          disabled={pending}
          options={CONTENT_PAGE_KEYS.map((key) => ({
            value: key,
            label: PAGE_PRESENTATION[key].label,
          }))}
          onValueChange={(value) => choosePage(value as ContentPageKey)}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <Card
          title="صفحات"
          description="صفحه موردنظر را برای ویرایش انتخاب کنید."
          className="hidden h-fit lg:block"
        >
          <nav aria-label="صفحات محتوایی" className="space-y-1">
            {CONTENT_PAGE_KEYS.map((key) => {
              const page = pages.find((item) => item.key === key);
              return (
                <button
                  key={key}
                  type="button"
                  disabled={pending}
                  onClick={() => choosePage(key)}
                  className={cn(
                    'flex w-full items-center justify-between gap-2 rounded-[var(--admin-radius-md)] px-3 py-2.5 text-start text-sm outline-none focus-visible:shadow-[var(--admin-focus-ring)]',
                    selectedKey === key
                      ? 'bg-[var(--admin-color-primary-soft)] font-bold text-[var(--admin-color-primary)]'
                      : 'hover:bg-[var(--admin-color-surface-hover)]',
                  )}
                >
                  <span>{PAGE_PRESENTATION[key].label}</span>
                  {page?.heroMediaId ? <span aria-label="دارای تصویر">●</span> : null}
                </button>
              );
            })}
          </nav>
        </Card>

        <form className="space-y-4" onSubmit={save}>
          <Card
            title={pageMeta.label}
            description={
              selectedPage.updatedAt
                ? `آخرین ویرایش: ${formatAdminDateTime(selectedPage.updatedAt)}`
                : 'هنوز سفارشی‌سازی نشده است.'
            }
            action={
              <ButtonLink
                href={`${previewBase}${pageMeta.href}`}
                target="_blank"
                rel="noreferrer"
                size="sm"
                variant="outline"
              >
                پیش‌نمایش صفحه
              </ButtonLink>
            }
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="content-title" label="عنوان صفحه" required>
                {(controlProps) => (
                  <Input
                    {...controlProps}
                    value={draft.title}
                    maxLength={200}
                    disabled={!canWrite || pending}
                    onChange={(event) => updateDraft({ title: event.target.value })}
                  />
                )}
              </FormField>
              <FormField id="content-eyebrow" label="بالانویس">
                {(controlProps) => (
                  <Input
                    {...controlProps}
                    value={draft.eyebrow}
                    maxLength={100}
                    disabled={!canWrite || pending}
                    onChange={(event) => updateDraft({ eyebrow: event.target.value })}
                  />
                )}
              </FormField>
              <FormField id="content-subtitle" label="زیرعنوان" className="sm:col-span-2">
                {(controlProps) => (
                  <Textarea
                    {...controlProps}
                    className="min-h-20"
                    value={draft.subtitle}
                    maxLength={500}
                    disabled={!canWrite || pending}
                    onChange={(event) => updateDraft({ subtitle: event.target.value })}
                  />
                )}
              </FormField>
              <FormField id="content-body" label="متن اصلی" className="sm:col-span-2">
                {(controlProps) => (
                  <Textarea
                    {...controlProps}
                    className="min-h-40"
                    value={draft.body}
                    maxLength={20_000}
                    disabled={!canWrite || pending}
                    onChange={(event) => updateDraft({ body: event.target.value })}
                  />
                )}
              </FormField>
            </div>
          </Card>

          <Card
            title="تصویر Hero"
            description={
              IMAGE_REQUIRED.has(selectedKey) ? 'برای این صفحه الزامی است.' : 'اختیاری است.'
            }
          >
            <SiteMediaField
              label={`Hero صفحه ${pageMeta.label}`}
              media={draft.heroMedia}
              altText={draft.title}
              disabled={!canWrite || pending}
              uploadUrl="/api/content-pages/media"
              onUploaded={(media) => updateDraft({ heroMediaId: media.id, heroMedia: media })}
              onClear={
                IMAGE_REQUIRED.has(selectedKey)
                  ? undefined
                  : () => updateDraft({ heroMediaId: null, heroMedia: null })
              }
            />
          </Card>

          <SectionEditor
            sections={draft.sections}
            disabled={!canWrite || pending}
            onChange={(sections) => updateDraft({ sections })}
          />

          <Card
            title="تنظیمات SEO"
            description="در صورت خالی‌بودن، عنوان و متن صفحه مبنای metadata قرار می‌گیرد."
          >
            <div className="grid gap-4">
              <FormField
                id="content-seo-title"
                label="عنوان SEO"
                hint={`${toPersianDigits(String(draft.seoTitle.length))} از ۲۰۰ نویسه`}
              >
                {(controlProps) => (
                  <Input
                    {...controlProps}
                    dir="rtl"
                    value={draft.seoTitle}
                    maxLength={200}
                    disabled={!canWrite || pending}
                    onChange={(event) => updateDraft({ seoTitle: event.target.value })}
                  />
                )}
              </FormField>
              <FormField
                id="content-seo-description"
                label="توضیح SEO"
                hint={`${toPersianDigits(String(draft.seoDescription.length))} از ۵۰۰ نویسه`}
              >
                {(controlProps) => (
                  <Textarea
                    {...controlProps}
                    value={draft.seoDescription}
                    maxLength={500}
                    disabled={!canWrite || pending}
                    onChange={(event) => updateDraft({ seoDescription: event.target.value })}
                  />
                )}
              </FormField>
            </div>
          </Card>

          {canWrite ? (
            <div className="sticky bottom-3 z-10 flex justify-end rounded-[var(--admin-radius-lg)] border border-[var(--admin-color-border)] bg-white/95 p-3 shadow-[var(--admin-shadow-md)] backdrop-blur">
              <Button type="submit" loading={pending}>
                ذخیره محتوای {pageMeta.label}
              </Button>
            </div>
          ) : null}
        </form>
      </div>
    </div>
  );
}
