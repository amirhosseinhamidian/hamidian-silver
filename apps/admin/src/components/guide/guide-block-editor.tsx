'use client';

import { SiteMediaField } from '@/components/site-settings/site-media-field';
import { GuideMarkdownEditor } from '@/components/guide/guide-markdown-editor';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input, Textarea } from '@/components/ui/form-control';
import { FormField } from '@/components/ui/form-field';
import { Select } from '@/components/ui/select';
import { guideBlockLabel, type GuideBlockType } from '@/lib/guide/guide-model';
import { formatAdminInteger } from '@/lib/presentation/formatters';
import type { SiteMedia } from '@/lib/site-settings/site-settings-model';

export type GuideBlockDraft = {
  clientId: string;
  type: GuideBlockType;
  variant: string;
  anchorId: string;
  primaryMediaId: string | null;
  primaryMedia: SiteMedia | null;
  heading: string;
  body: string;
  auxiliary: string;
  buttonLabel: string;
  buttonHref: string;
};

const BLOCK_TYPES: readonly GuideBlockType[] = [
  'LEAD',
  'RICH_TEXT',
  'IMAGE',
  'IMAGE_TEXT',
  'STEPS',
  'QUOTE',
  'TABLE',
  'FAQ',
  'GALLERY',
  'PRODUCT_CARDS',
  'CTA',
  'DIVIDER',
];
const MARKDOWN_BLOCK_TYPES = new Set<GuideBlockType>(['LEAD', 'RICH_TEXT', 'IMAGE_TEXT']);
const VARIANTS: Record<GuideBlockType, readonly { value: string; label: string }[]> = {
  LEAD: [
    { value: 'editorial', label: 'ادیتوریال' },
    { value: 'soft', label: 'پس‌زمینه ملایم' },
  ],
  RICH_TEXT: [
    { value: 'standard', label: 'استاندارد' },
    { value: 'narrow', label: 'ستون باریک' },
    { value: 'highlight', label: 'برجسته' },
  ],
  IMAGE: [
    { value: 'wide', label: 'تمام‌عرض' },
    { value: 'contained', label: 'داخل قاب' },
  ],
  IMAGE_TEXT: [
    { value: 'image-right', label: 'تصویر سمت راست' },
    { value: 'image-left', label: 'تصویر سمت چپ' },
    { value: 'stacked', label: 'چیدمان عمودی' },
  ],
  STEPS: [
    { value: 'numbered', label: 'شماره‌دار' },
    { value: 'cards', label: 'کارت‌ها' },
  ],
  QUOTE: [
    { value: 'minimal', label: 'مینیمال' },
    { value: 'accent', label: 'تأکیدی' },
  ],
  TABLE: [
    { value: 'standard', label: 'استاندارد' },
    { value: 'comparison', label: 'مقایسه‌ای' },
  ],
  FAQ: [
    { value: 'accordion', label: 'آکاردئون' },
    { value: 'cards', label: 'کارت‌ها' },
  ],
  GALLERY: [
    { value: 'featured', label: 'تصویر شاخص' },
    { value: 'grid', label: 'شبکه‌ای' },
  ],
  PRODUCT_CARDS: [
    { value: 'carousel', label: 'اسلایدی' },
    { value: 'grid', label: 'شبکه‌ای' },
  ],
  CTA: [
    { value: 'primary', label: 'اصلی' },
    { value: 'soft', label: 'ملایم' },
  ],
  DIVIDER: [
    { value: 'line', label: 'خط ساده' },
    { value: 'ornament', label: 'نشان تزئینی' },
  ],
};

function needsMedia(type: GuideBlockType): boolean {
  return ['LEAD', 'IMAGE', 'IMAGE_TEXT', 'GALLERY', 'CTA'].includes(type);
}

function auxiliaryLabel(type: GuideBlockType): string {
  if (type === 'STEPS') return 'هر مرحله در یک خط: عنوان | توضیح';
  if (type === 'FAQ') return 'هر پرسش در یک خط: پرسش | پاسخ';
  if (type === 'TABLE') return 'جدول؛ ستون‌ها را با Tab و ردیف‌ها را با Enter جدا کنید';
  if (type === 'QUOTE') return 'نام یا منبع نقل‌قول';
  if (type === 'IMAGE' || type === 'GALLERY') return 'کپشن تصویر';
  return 'متن تکمیلی';
}

export function GuideBlockEditor({
  blocks,
  disabled,
  onChange,
}: Readonly<{
  blocks: readonly GuideBlockDraft[];
  disabled: boolean;
  onChange: (blocks: GuideBlockDraft[]) => void;
}>) {
  function update(index: number, patch: Partial<GuideBlockDraft>) {
    onChange(
      blocks.map((block, itemIndex) => (itemIndex === index ? { ...block, ...patch } : block)),
    );
  }
  function add() {
    const clientId = globalThis.crypto?.randomUUID?.() ?? `block-${Date.now()}`;
    onChange([
      ...blocks,
      {
        clientId,
        type: 'RICH_TEXT',
        variant: 'standard',
        anchorId: '',
        primaryMediaId: null,
        primaryMedia: null,
        heading: '',
        body: '',
        auxiliary: '',
        buttonLabel: '',
        buttonHref: '',
      },
    ]);
  }
  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    [next[index], next[target]] = [next[target]!, next[index]!];
    onChange(next);
  }
  return (
    <Card
      title="چینش اختصاصی محتوا"
      description="با ترکیب بلوک‌ها، هر دانستنی می‌تواند ساختار و ریتم بصری متفاوتی داشته باشد."
      action={
        <Button size="sm" variant="outline" disabled={disabled} onClick={add}>
          افزودن بلوک
        </Button>
      }
    >
      {blocks.length ? (
        <div className="space-y-4">
          {blocks.map((block, index) => (
            <article
              key={block.clientId}
              className="rounded-[var(--admin-radius-lg)] border border-[var(--admin-color-border)] bg-[var(--admin-color-surface-subtle)] p-4"
            >
              <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge tone="info">بخش {formatAdminInteger(index + 1)}</Badge>
                  <strong className="text-sm">{guideBlockLabel(block.type)}</strong>
                </div>
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
                    disabled={disabled || index === blocks.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    پایین‌تر
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={disabled}
                    onClick={() => onChange(blocks.filter((_, itemIndex) => itemIndex !== index))}
                  >
                    حذف
                  </Button>
                </div>
              </header>
              <div className="grid gap-4 md:grid-cols-2">
                <FormField id={`guide-block-${block.clientId}-type`} label="نوع بلوک">
                  {(props) => (
                    <Select
                      {...props}
                      value={block.type}
                      disabled={disabled}
                      options={BLOCK_TYPES.map((type) => ({
                        value: type,
                        label: guideBlockLabel(type),
                      }))}
                      onValueChange={(value) => {
                        const type = value as GuideBlockType;
                        update(index, { type, variant: VARIANTS[type][0]?.value ?? '' });
                      }}
                    />
                  )}
                </FormField>
                <FormField id={`guide-block-${block.clientId}-variant`} label="سبک نمایش">
                  {(props) => (
                    <Select
                      {...props}
                      value={block.variant}
                      disabled={disabled}
                      options={VARIANTS[block.type]}
                      onValueChange={(value) => update(index, { variant: value })}
                    />
                  )}
                </FormField>
                <FormField
                  id={`guide-block-${block.clientId}-heading`}
                  label={block.type === 'QUOTE' ? 'متن نقل‌قول' : 'عنوان'}
                >
                  {(props) => (
                    <Input
                      {...props}
                      value={block.heading}
                      maxLength={300}
                      disabled={disabled}
                      onChange={(event) => update(index, { heading: event.target.value })}
                    />
                  )}
                </FormField>
                <FormField
                  id={`guide-block-${block.clientId}-anchor`}
                  label="شناسه لینک داخلی"
                  hint="اختیاری؛ مانند silver-care"
                >
                  {(props) => (
                    <Input
                      {...props}
                      dir="ltr"
                      value={block.anchorId}
                      maxLength={80}
                      disabled={disabled}
                      onChange={(event) => update(index, { anchorId: event.target.value })}
                    />
                  )}
                </FormField>
                {block.type !== 'DIVIDER' &&
                block.type !== 'TABLE' &&
                block.type !== 'STEPS' &&
                block.type !== 'FAQ' ? (
                  <div className="md:col-span-2">
                    <FormField
                      id={`guide-block-${block.clientId}-body`}
                      label={
                        block.type === 'RICH_TEXT'
                          ? 'متن؛ هر پاراگراف را با یک خط خالی جدا کنید'
                          : 'متن'
                      }
                    >
                      {(props) =>
                        MARKDOWN_BLOCK_TYPES.has(block.type) ? (
                          <GuideMarkdownEditor
                            id={props.id}
                            value={block.body}
                            disabled={disabled}
                            onChange={(body) => update(index, { body })}
                          />
                        ) : (
                          <Textarea
                            {...props}
                            value={block.body}
                            maxLength={20000}
                            disabled={disabled}
                            className="min-h-36"
                            onChange={(event) => update(index, { body: event.target.value })}
                          />
                        )
                      }
                    </FormField>
                  </div>
                ) : null}
                {['STEPS', 'FAQ', 'TABLE', 'QUOTE', 'IMAGE', 'GALLERY'].includes(block.type) ? (
                  <div className="md:col-span-2">
                    <FormField
                      id={`guide-block-${block.clientId}-auxiliary`}
                      label={auxiliaryLabel(block.type)}
                    >
                      {(props) => (
                        <Textarea
                          {...props}
                          dir={block.type === 'TABLE' ? 'ltr' : undefined}
                          value={block.auxiliary}
                          maxLength={20000}
                          disabled={disabled}
                          onChange={(event) => update(index, { auxiliary: event.target.value })}
                        />
                      )}
                    </FormField>
                  </div>
                ) : null}
                {block.type === 'CTA' ? (
                  <>
                    <FormField id={`guide-block-${block.clientId}-button-label`} label="متن دکمه">
                      {(props) => (
                        <Input
                          {...props}
                          value={block.buttonLabel}
                          maxLength={100}
                          disabled={disabled}
                          onChange={(event) => update(index, { buttonLabel: event.target.value })}
                        />
                      )}
                    </FormField>
                    <FormField id={`guide-block-${block.clientId}-button-href`} label="لینک دکمه">
                      {(props) => (
                        <Input
                          {...props}
                          dir="ltr"
                          value={block.buttonHref}
                          maxLength={1000}
                          disabled={disabled}
                          placeholder="/products"
                          onChange={(event) => update(index, { buttonHref: event.target.value })}
                        />
                      )}
                    </FormField>
                  </>
                ) : null}
                {needsMedia(block.type) ? (
                  <div className="md:col-span-2">
                    <SiteMediaField
                      label={`تصویر ${guideBlockLabel(block.type)}`}
                      media={block.primaryMedia}
                      altText={block.heading || 'تصویر دانستنی'}
                      uploadUrl="/api/content-pages/media"
                      disabled={disabled}
                      aspect="wide"
                      onUploaded={(media) =>
                        update(index, { primaryMediaId: media.id, primaryMedia: media })
                      }
                      onClear={() => update(index, { primaryMediaId: null, primaryMedia: null })}
                    />
                  </div>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-[var(--admin-radius-md)] border border-dashed border-[var(--admin-color-border-strong)] p-8 text-center">
          <p className="font-bold">هنوز بلوکی اضافه نشده است</p>
          <p className="mt-2 text-sm text-[var(--admin-color-muted)]">
            برای انتشار حداقل یک بلوک محتوایی لازم است.
          </p>
          <Button className="mt-4" variant="outline" disabled={disabled} onClick={add}>
            افزودن اولین بلوک
          </Button>
        </div>
      )}
    </Card>
  );
}
