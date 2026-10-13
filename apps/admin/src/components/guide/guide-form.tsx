'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState, type FormEvent } from 'react';
import { GuideBlockEditor, type GuideBlockDraft } from './guide-block-editor';
import { SiteMediaField } from '@/components/site-settings/site-media-field';
import {
  createSeoEditorValue,
  isValidSeoCanonicalPath,
  SeoEditor,
  seoEditorPayload,
  type SeoEditorValue,
} from '@/components/seo/seo-editor';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input, Textarea } from '@/components/ui/form-control';
import { FormField } from '@/components/ui/form-field';
import { Select } from '@/components/ui/select';
import {
  guideFormatLabel,
  type GuideArticle,
  type GuideArticleFormat,
  type GuideArticleStatus,
  type GuideProductRecommendationMode,
  type GuideFormReferences,
} from '@/lib/guide/guide-model';
import type { SiteMedia } from '@/lib/site-settings/site-settings-model';

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
function draftFromArticle(article: GuideArticle | null): GuideBlockDraft[] {
  return (article?.blocks ?? []).map((block) => {
    const content = block.content;
    let body = stringValue(content.markdown) || stringValue(content.body);
    let auxiliary = stringValue(content.caption ?? content.attribution);
    if (Array.isArray(content.paragraphs))
      body = content.paragraphs
        .filter((item): item is string => typeof item === 'string')
        .join('\n\n');
    if (Array.isArray(content.items))
      auxiliary = content.items
        .map((item) => {
          const row = typeof item === 'object' && item ? (item as Record<string, unknown>) : {};
          return `${stringValue(row.title ?? row.question)} | ${stringValue(row.body ?? row.answer)}`;
        })
        .join('\n');
    if (Array.isArray(content.columns)) {
      const rows = Array.isArray(content.rows) ? content.rows : [];
      auxiliary = [content.columns, ...rows]
        .map((row) => (Array.isArray(row) ? row.join('\t') : ''))
        .join('\n');
    }
    return {
      clientId: block.id,
      type: block.type,
      variant: block.variant ?? '',
      anchorId: block.anchorId ?? '',
      primaryMediaId: block.primaryMedia?.id ?? null,
      primaryMedia: block.primaryMedia,
      heading: stringValue(content.heading ?? content.quote),
      body,
      auxiliary,
      buttonLabel: stringValue(content.buttonLabel),
      buttonHref: stringValue(content.buttonHref),
    };
  });
}

function blockContent(block: GuideBlockDraft): Record<string, unknown> {
  const heading = block.heading.trim();
  const body = block.body.trim();
  if (block.type === 'RICH_TEXT')
    return {
      heading,
      markdown: body,
      paragraphs: body
        .split(/\n\s*\n/)
        .map((item) => item.trim())
        .filter(Boolean),
    };
  if (block.type === 'LEAD' || block.type === 'IMAGE_TEXT')
    return { heading, markdown: body, body };
  if (block.type === 'STEPS')
    return {
      heading,
      items: block.auxiliary
        .split('\n')
        .map((line) => {
          const [title, ...rest] = line.split('|');
          return { title: title?.trim() ?? '', body: rest.join('|').trim() };
        })
        .filter((item) => item.title),
    };
  if (block.type === 'FAQ')
    return {
      heading,
      items: block.auxiliary
        .split('\n')
        .map((line) => {
          const [question, ...rest] = line.split('|');
          return { question: question?.trim() ?? '', answer: rest.join('|').trim() };
        })
        .filter((item) => item.question),
    };
  if (block.type === 'TABLE') {
    const rows = block.auxiliary
      .split('\n')
      .map((line) => line.split('\t').map((cell) => cell.trim()))
      .filter((row) => row.some(Boolean));
    return { heading, columns: rows[0] ?? [], rows: rows.slice(1) };
  }
  if (block.type === 'QUOTE') return { quote: heading, attribution: block.auxiliary.trim(), body };
  if (block.type === 'IMAGE' || block.type === 'GALLERY')
    return { heading, caption: block.auxiliary.trim() };
  if (block.type === 'CTA')
    return {
      heading,
      body,
      buttonLabel: block.buttonLabel.trim(),
      buttonHref: block.buttonHref.trim(),
    };
  if (block.type === 'DIVIDER') return {};
  return { heading, body };
}

function responseMessage(payload: unknown, fallback: string): string {
  if (typeof payload === 'object' && payload !== null) {
    const message = (payload as Record<string, unknown>).message;
    if (typeof message === 'string') return message;
    if (Array.isArray(message)) return message.join('، ');
  }
  return fallback;
}

function SelectionGroup({
  title,
  items,
  selected,
  disabled,
  onChange,
}: Readonly<{
  title: string;
  items: readonly { id: string; name: string }[];
  selected: readonly string[];
  disabled: boolean;
  onChange: (ids: string[]) => void;
}>) {
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  return (
    <section>
      <h3 className="text-sm font-bold">{title}</h3>
      <div className="mt-2 max-h-56 space-y-2 overflow-y-auto rounded-[var(--admin-radius-md)] border border-[var(--admin-color-border)] p-3">
        {items.map((item) => (
          <Checkbox
            key={item.id}
            id={`guide-ref-${title}-${item.id}`}
            label={item.name}
            checked={selectedSet.has(item.id)}
            disabled={disabled}
            onChange={(event) =>
              onChange(
                event.currentTarget.checked
                  ? [...selected, item.id]
                  : selected.filter((id) => id !== item.id),
              )
            }
          />
        ))}
        {!items.length ? (
          <p className="text-xs text-[var(--admin-color-muted)]">موردی برای انتخاب وجود ندارد.</p>
        ) : null}
      </div>
    </section>
  );
}

export function GuideForm({
  article,
  references,
}: Readonly<{ article: GuideArticle | null; references: GuideFormReferences }>) {
  const router = useRouter();
  const mode = article ? 'edit' : 'create';
  const [title, setTitle] = useState(article?.title ?? '');
  const [slug, setSlug] = useState(article?.slug ?? '');
  const [eyebrow, setEyebrow] = useState(article?.eyebrow ?? '');
  const [excerpt, setExcerpt] = useState(article?.excerpt ?? '');
  const [format, setFormat] = useState<GuideArticleFormat>(article?.format ?? 'GUIDE');
  const [status, setStatus] = useState<GuideArticleStatus>(article?.status ?? 'DRAFT');
  const [heroMedia, setHeroMedia] = useState<SiteMedia | null>(article?.heroMedia ?? null);
  const [heroMobileMedia, setHeroMobileMedia] = useState<SiteMedia | null>(
    article?.heroMobileMedia ?? null,
  );
  const [cardMedia, setCardMedia] = useState<SiteMedia | null>(article?.cardMedia ?? null);
  const [productRecommendationMode, setProductRecommendationMode] =
    useState<GuideProductRecommendationMode>(article?.productRecommendationMode ?? 'AUTOMATIC');
  const [keywords, setKeywords] = useState(article?.searchKeywords.join('، ') ?? '');
  const [readingTime, setReadingTime] = useState(article?.readingTimeMinutes?.toString() ?? '');
  const [featured, setFeatured] = useState(article?.isFeatured ?? false);
  const [topicIds, setTopicIds] = useState(article?.topics.map((topic) => topic.id) ?? []);
  const [productIds, setProductIds] = useState(article?.productIds ?? []);
  const [categoryIds, setCategoryIds] = useState(article?.categoryIds ?? []);
  const [brandIds, setBrandIds] = useState(article?.brandIds ?? []);
  const [blocks, setBlocks] = useState<GuideBlockDraft[]>(draftFromArticle(article));
  const [seo, setSeo] = useState<SeoEditorValue>(
    createSeoEditorValue(
      article ? { ...article, seoOgMediaId: article.seoOgMedia?.id ?? null } : null,
    ),
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function validate(): string | null {
    if (!title.trim()) return 'عنوان دانستنی الزامی است.';
    if (!/^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u.test(slug.trim()))
      return 'اسلاگ فقط می‌تواند شامل حروف، عدد و خط تیره باشد.';
    if (status === 'PUBLISHED' && !excerpt.trim()) return 'برای انتشار، خلاصه دانستنی الزامی است.';
    if (status === 'PUBLISHED' && !blocks.length)
      return 'برای انتشار، حداقل یک بلوک محتوا لازم است.';
    if (!isValidSeoCanonicalPath(seo.canonicalPath.trim(), '/guide/'))
      return 'مسیر canonical باید با ‎/guide/‎ شروع شود و query یا fragment نداشته باشد.';
    const anchors = blocks.map((block) => block.anchorId.trim()).filter(Boolean);
    if (new Set(anchors).size !== anchors.length) return 'شناسه لینک داخلی بلوک‌ها باید یکتا باشد.';
    if (
      blocks.some(
        (block) =>
          block.type !== 'DIVIDER' &&
          !block.heading.trim() &&
          !block.body.trim() &&
          !block.auxiliary.trim(),
      )
    )
      return 'یکی از بلوک‌ها هیچ محتوایی ندارد.';
    return null;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const issue = validate();
    if (issue) {
      setError(issue);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setPending(true);
    setError(null);
    const payload = {
      title: title.trim(),
      slug: slug.trim().toLowerCase(),
      eyebrow: eyebrow.trim() || null,
      excerpt: excerpt.trim() || null,
      format,
      status,
      heroMediaId: heroMedia?.id ?? null,
      heroMobileMediaId: heroMobileMedia?.id ?? null,
      cardMediaId: cardMedia?.id ?? null,
      productRecommendationMode,
      ...seoEditorPayload(seo),
      searchKeywords: keywords
        .split(/[،,\n]/)
        .map((item) => item.trim())
        .filter(Boolean),
      readingTimeMinutes: readingTime ? Number(readingTime) : null,
      isFeatured: featured,
      topicIds,
      productIds,
      categoryIds,
      brandIds,
      blocks: blocks.map((block, sortOrder) => ({
        type: block.type,
        variant: block.variant || null,
        anchorId: block.anchorId.trim() || null,
        primaryMediaId: block.primaryMediaId,
        content: blockContent(block),
        sortOrder,
      })),
      ...(article ? { expectedVersion: article.version } : {}),
    };
    try {
      const response = await fetch(
        article ? `/api/guide/articles/${article.id}` : '/api/guide/articles',
        {
          method: article ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
      const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
      if (!response.ok) throw new Error(responseMessage(body, 'ذخیره دانستنی انجام نشد.'));
      const savedId = typeof body?.id === 'string' ? body.id : article?.id;
      router.push(savedId ? `/knowledge/${savedId}/edit?saved=1` : '/knowledge');
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'ذخیره دانستنی انجام نشد.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form id="guide-form" onSubmit={(event) => void submit(event)} className="space-y-6">
      <header className="flex flex-col gap-4 border-b border-[var(--admin-color-border)] pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Badge tone="info">دانستنی‌ها</Badge>
          <h1 className="mt-3 text-2xl font-black sm:text-3xl">
            {mode === 'create' ? 'ساخت دانستنی' : 'ویرایش دانستنی'}
          </h1>
          <p className="mt-2 text-sm leading-7 text-[var(--admin-color-muted)]">
            محتوا را با بلوک‌های طراحی‌شده بسازید؛ ظاهر نهایی با زبان بصری فروشگاه هماهنگ می‌ماند.
          </p>
        </div>
        <div className="flex gap-2">
          <ButtonLink href="/knowledge" variant="ghost">
            انصراف
          </ButtonLink>
          <Button type="submit" loading={pending}>
            {mode === 'create' ? 'ساخت دانستنی' : 'ذخیره تغییرات'}
          </Button>
        </div>
      </header>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <Card
        title="اطلاعات اصلی"
        description="عنوان و خلاصه باید به سؤال یا نیاز واقعی کاربر پاسخ دهند."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <FormField id="guide-title" label="عنوان" required>
            {(props) => (
              <Input
                {...props}
                value={title}
                maxLength={220}
                disabled={pending}
                onChange={(event) => setTitle(event.target.value)}
              />
            )}
          </FormField>
          <FormField id="guide-slug" label="اسلاگ" required hint="نمونه: how-to-clean-silver">
            {(props) => (
              <Input
                {...props}
                dir="ltr"
                value={slug}
                maxLength={220}
                disabled={pending}
                onChange={(event) => setSlug(event.target.value)}
              />
            )}
          </FormField>
          <FormField id="guide-eyebrow" label="بالانویس">
            {(props) => (
              <Input
                {...props}
                value={eyebrow}
                maxLength={100}
                disabled={pending}
                placeholder="راهنمای نگهداری"
                onChange={(event) => setEyebrow(event.target.value)}
              />
            )}
          </FormField>
          <FormField id="guide-format" label="نوع محتوا">
            {(props) => (
              <Select
                {...props}
                value={format}
                disabled={pending}
                options={(
                  [
                    'GUIDE',
                    'ANSWER',
                    'BUYING_GUIDE',
                    'CARE_GUIDE',
                    'COMPARISON',
                    'STORY',
                  ] as GuideArticleFormat[]
                ).map((value) => ({ value, label: guideFormatLabel(value) }))}
                onValueChange={(value) => setFormat(value as GuideArticleFormat)}
              />
            )}
          </FormField>
          <div className="md:col-span-2">
            <FormField id="guide-excerpt" label="خلاصه" required={status === 'PUBLISHED'}>
              {(props) => (
                <Textarea
                  {...props}
                  value={excerpt}
                  maxLength={700}
                  disabled={pending}
                  onChange={(event) => setExcerpt(event.target.value)}
                />
              )}
            </FormField>
          </div>
          <FormField id="guide-status" label="وضعیت انتشار">
            {(props) => (
              <Select
                {...props}
                value={status}
                disabled={pending}
                options={[
                  { value: 'DRAFT', label: 'پیش‌نویس' },
                  { value: 'PUBLISHED', label: 'منتشرشده' },
                  { value: 'ARCHIVED', label: 'آرشیوشده' },
                ]}
                onValueChange={(value) => setStatus(value as GuideArticleStatus)}
              />
            )}
          </FormField>
          <FormField id="guide-reading-time" label="زمان مطالعه (دقیقه)">
            {(props) => (
              <Input
                {...props}
                type="number"
                min={1}
                max={180}
                value={readingTime}
                disabled={pending}
                onChange={(event) => setReadingTime(event.target.value)}
              />
            )}
          </FormField>
          <div className="md:col-span-2">
            <FormField
              id="guide-keywords"
              label="کلیدواژه‌های جست‌وجوی داخلی"
              hint="با ویرگول جدا کنید"
            >
              {(props) => (
                <Input
                  {...props}
                  value={keywords}
                  maxLength={2000}
                  disabled={pending}
                  onChange={(event) => setKeywords(event.target.value)}
                />
              )}
            </FormField>
          </div>
          <div className="md:col-span-2">
            <Checkbox
              id="guide-featured"
              label="نمایش به‌عنوان دانستنی منتخب"
              description="برای نمایش برجسته در صفحه اصلی دانستنی‌ها استفاده می‌شود."
              checked={featured}
              disabled={pending}
              onChange={(event) => setFeatured(event.currentTarget.checked)}
            />
          </div>
        </div>
      </Card>
      <Card
        title="تصاویر مقاله"
        description="Hero دسکتاپ و موبایل مستقل هستند؛ تصویر کارت با نسبت ۴:۳ در فهرست‌ها نمایش داده می‌شود."
      >
        <div className="grid gap-5 lg:grid-cols-2">
          <SiteMediaField
            label="Hero دسکتاپ"
            media={heroMedia}
            altText={title || 'دانستنی'}
            uploadUrl="/api/content-pages/media"
            aspect="page-desktop"
            disabled={pending}
            onUploaded={setHeroMedia}
            onClear={() => setHeroMedia(null)}
          />
          <SiteMediaField
            label="Hero موبایل"
            media={heroMobileMedia}
            altText={title || 'دانستنی'}
            uploadUrl="/api/content-pages/media"
            aspect="mobile"
            disabled={pending}
            onUploaded={setHeroMobileMedia}
            onClear={() => setHeroMobileMedia(null)}
          />
          <SiteMediaField
            label="تصویر شاخص کارت"
            media={cardMedia}
            altText={title || 'دانستنی'}
            uploadUrl="/api/content-pages/media"
            aspect="card"
            hint="ابعاد پیشنهادی ۱۲۰۰×۹۰۰ پیکسل؛ در صورت خالی بودن از Hero دسکتاپ استفاده می‌شود."
            disabled={pending}
            onUploaded={setCardMedia}
            onClear={() => setCardMedia(null)}
          />
        </div>
      </Card>
      <GuideBlockEditor blocks={blocks} disabled={pending} onChange={setBlocks} />
      <Card
        title="ارتباط محتوایی"
        description="این ارتباط‌ها برای پیشنهاد محصول، لینک‌سازی داخلی و ساخت خوشه‌های موضوعی استفاده می‌شوند."
      >
        <div className="mb-5">
          <FormField id="guide-product-recommendation-mode" label="نحوه نمایش محصولات پیشنهادی">
            {(props) => (
              <Select
                {...props}
                value={productRecommendationMode}
                disabled={pending}
                options={[
                  { value: 'AUTOMATIC', label: 'انتخاب خودکار' },
                  { value: 'MANUAL', label: 'انتخاب دستی' },
                  { value: 'DISABLED', label: 'غیرفعال' },
                ]}
                onValueChange={(value) =>
                  setProductRecommendationMode(value as GuideProductRecommendationMode)
                }
              />
            )}
          </FormField>
          <p className="mt-2 text-xs leading-6 text-[var(--admin-color-muted)]">
            در حالت خودکار، محصولات فعال و موجود از دسته‌بندی‌های مرتبط انتخاب می‌شوند. شناسه‌های
            دستی با تغییر حالت حذف نمی‌شوند.
          </p>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <SelectionGroup
            title="موضوعات"
            items={references.topics}
            selected={topicIds}
            disabled={pending}
            onChange={setTopicIds}
          />
          <SelectionGroup
            title="دسته‌بندی‌ها"
            items={references.categories}
            selected={categoryIds}
            disabled={pending}
            onChange={setCategoryIds}
          />
          <SelectionGroup
            title="برندها"
            items={references.brands}
            selected={brandIds}
            disabled={pending}
            onChange={setBrandIds}
          />
          <SelectionGroup
            title="محصولات پیشنهادی"
            items={references.products}
            selected={productIds}
            disabled={pending || productRecommendationMode !== 'MANUAL'}
            onChange={setProductIds}
          />
        </div>
      </Card>
      <SeoEditor
        value={seo}
        onChange={setSeo}
        canonicalPlaceholder={`/guide/${slug || 'article-slug'}`}
        defaultTitle={title || 'عنوان دانستنی'}
        uploadUrl="/api/content-pages/media"
        canonicalPrefix="/guide/"
        disabled={pending}
      />
    </form>
  );
}
