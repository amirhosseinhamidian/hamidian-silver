'use client';

import type { components } from '@hamidian/contracts';
import { useState } from 'react';
import { SiteMediaField } from '@/components/site-settings/site-media-field';
import { Button } from '@/components/ui/button';
import { DualCalendarPicker } from '@/components/ui/dual-calendar-picker';
import { Input, Textarea } from '@/components/ui/form-control';
import { addCampaignSelection, type CampaignTaxonomy } from '@/lib/campaigns/campaign-selection';
import { CampaignProductSearch } from './campaign-product-search';
import { CampaignTaxonomyPicker } from './campaign-taxonomy-picker';

type Section = components['schemas']['FestivalSectionDto'];
type Slide = components['schemas']['FestivalHeroSlideDto'];
type Media = components['schemas']['CampaignMediaDto'];
type Artwork = NonNullable<Section['artwork']>;

const mediaFields = [
  ['mediaId', 'تصویر دسکتاپ'],
  ['mobileMediaId', 'تصویر موبایل'],
  ['stillMediaId', 'تصویر ثابت جایگزین GIF'],
] as const;

function ArtworkFields({
  artwork,
  assets,
  update,
  uploaded,
  onPendingChange,
}: {
  artwork: Artwork;
  assets: Readonly<Record<string, Media>>;
  update: (artwork: Artwork) => void;
  uploaded: (asset: Media) => void;
  onPendingChange: (pending: boolean) => void;
}) {
  const [alt, setAlt] = useState<Partial<Record<(typeof mediaFields)[number][0], string>>>({});
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {mediaFields.map(([key, label]) => {
        const media = assets[artwork[key] ?? ''] ?? null;
        const altText = alt[key] ?? media?.altText ?? '';
        return (
          <div key={key} className="space-y-2">
            <label className="grid gap-1 text-xs">
              متن جایگزین برای {label}
              <Input
                value={altText}
                maxLength={255}
                onChange={(e) => {
                  const text = e.currentTarget.value;
                  setAlt((current) => ({ ...current, [key]: text }));
                }}
              />
            </label>
            <SiteMediaField
              label={label}
              media={media}
              altText={altText}
              uploadUrl="/api/campaigns/media"
              allowCampaignGif={key !== 'stillMediaId'}
              onPendingChange={onPendingChange}
              onUploaded={(asset) => {
                uploaded(asset);
                update({ ...artwork, [key]: asset.id });
              }}
              onClear={() => update({ ...artwork, [key]: undefined })}
            />
          </div>
        );
      })}
    </div>
  );
}

function SlideFields({
  slide,
  assets,
  update,
  uploaded,
  onPendingChange,
}: {
  slide: Slide;
  assets: Readonly<Record<string, Media>>;
  update: (slide: Slide) => void;
  uploaded: (asset: Media) => void;
  onPendingChange: (pending: boolean) => void;
}) {
  return (
    <div className="space-y-3 rounded-lg border border-[var(--admin-color-border)] p-3">
      <div className="grid gap-2 md:grid-cols-2">
        <label className="grid gap-1 text-sm">
          عنوان اسلاید
          <Input
            required
            value={slide.title}
            maxLength={100}
            onChange={(e) => update({ ...slide, title: e.currentTarget.value })}
          />
        </label>
        <label className="grid gap-1 text-sm">
          متن اسلاید
          <Input
            value={slide.subtitle ?? ''}
            maxLength={240}
            onChange={(e) => update({ ...slide, subtitle: e.currentTarget.value || undefined })}
          />
        </label>
        <label className="grid gap-1 text-sm">
          متن دکمه
          <Input
            value={slide.actionLabel ?? ''}
            maxLength={80}
            onChange={(e) => update({ ...slide, actionLabel: e.currentTarget.value || undefined })}
          />
        </label>
        <label className="grid gap-1 text-sm">
          مسیر دکمه
          <Input
            dir="ltr"
            placeholder="#campaign-products"
            value={slide.actionPath ?? ''}
            maxLength={220}
            onChange={(e) => update({ ...slide, actionPath: e.currentTarget.value || undefined })}
          />
        </label>
      </div>
      <ArtworkFields
        artwork={slide}
        assets={assets}
        uploaded={uploaded}
        onPendingChange={onPendingChange}
        update={(artwork) => update({ ...slide, ...artwork, mediaId: artwork.mediaId ?? '' })}
      />
    </div>
  );
}

export function FestivalSectionEditor({
  section,
  campaignId,
  taxonomy,
  update,
  assets,
  uploaded,
  onPendingChange,
}: {
  section: Section;
  campaignId: string;
  taxonomy?: CampaignTaxonomy;
  update: (section: Section) => void;
  assets: Readonly<Record<string, Media>>;
  uploaded: (asset: Media) => void;
  onPendingChange: (pending: boolean) => void;
}) {
  const entries = section.entries ?? [];
  const slides = section.slides ?? [];
  const entrySection = ['HIGHLIGHTS', 'BUDGET', 'FAQ', 'OFFERS'].includes(section.kind);
  const selectedSource = ['PICKS', 'OFFERS', 'DISCOUNTS', 'LOW_QUOTA', 'CATEGORIES'].includes(
    section.kind,
  );
  const slugs = section.slugs ?? [];
  const selectSlugs = (next: string[]) =>
    update({ ...section, slugs: next.length ? next : undefined });

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">
          عنوان بخش
          <Input
            required
            maxLength={100}
            value={section.title}
            onChange={(e) => update({ ...section, title: e.currentTarget.value })}
          />
        </label>
        {section.kind !== 'HERO' && section.kind !== 'COUNTDOWN' && (
          <>
            <label className="grid gap-1 text-sm sm:col-span-2">
              توضیح بخش
              <Textarea
                maxLength={500}
                value={section.description ?? ''}
                placeholder={
                  section.kind === 'INTRO'
                    ? 'خالی بماند تا متن معرفی لندینگ نمایش داده شود'
                    : undefined
                }
                rows={2}
                onChange={(event) =>
                  update({ ...section, description: event.currentTarget.value || undefined })
                }
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={section.highlighted ?? false}
                onChange={(event) =>
                  update({ ...section, highlighted: event.currentTarget.checked })
                }
              />
              استفاده از پس‌زمینهٔ دوم تم
            </label>
          </>
        )}
        {section.kind !== 'PRODUCTS' && (
          <>
            {section.kind !== 'HERO' &&
              section.kind !== 'COUNTDOWN' &&
              section.kind !== 'INTRO' && (
                <label className="grid gap-1 text-sm">
                  چیدمان
                  <select
                    className="min-h-10 rounded-md border border-[var(--admin-color-border)] px-2"
                    value={section.layout}
                    onChange={(e) =>
                      update({
                        ...section,
                        layout: e.currentTarget.value === 'STRIP' ? 'STRIP' : 'GRID',
                      })
                    }
                  >
                    <option value="GRID">شبکه‌ای</option>
                    <option value="STRIP">ردیفی</option>
                  </select>
                </label>
              )}
            {(['startsTehran', 'endsTehran'] as const).map((key) => (
              <DualCalendarPicker
                key={key}
                label={key === 'startsTehran' ? 'زمان آغاز سکشن' : 'زمان پایان سکشن'}
                value={section[key] ?? ''}
                onChange={(value) => update({ ...section, [key]: value || undefined })}
              />
            ))}
          </>
        )}
        {(section.kind === 'DISCOUNTS' || section.kind === 'LOW_QUOTA') && (
          <label className="grid gap-1 text-sm">
            {section.kind === 'DISCOUNTS' ? 'حداقل درصد تخفیف' : 'حداکثر تعداد باقی‌مانده'}
            <Input
              type="number"
              min={1}
              max={100}
              value={section.threshold ?? ''}
              onChange={(e) =>
                update({
                  ...section,
                  threshold: e.currentTarget.value ? e.currentTarget.valueAsNumber : undefined,
                })
              }
            />
          </label>
        )}
        {selectedSource && (
          <label className="grid gap-1 text-sm">
            حداکثر تعداد نمایش
            <Input
              type="number"
              min={1}
              max={24}
              placeholder="۱۲"
              value={section.itemLimit ?? ''}
              onChange={(event) =>
                update({
                  ...section,
                  itemLimit: event.currentTarget.value
                    ? event.currentTarget.valueAsNumber
                    : undefined,
                })
              }
            />
          </label>
        )}
      </div>

      {section.kind !== 'HERO' && section.kind !== 'COUNTDOWN' && (
        <details open={section.artwork?.mediaId ? true : undefined}>
          <summary className="mb-2 cursor-pointer text-sm">رسانهٔ بخش</summary>
          <ArtworkFields
            artwork={section.artwork ?? {}}
            assets={assets}
            uploaded={uploaded}
            onPendingChange={onPendingChange}
            update={(artwork) => update({ ...section, artwork })}
          />
        </details>
      )}

      {selectedSource && (
        <div className="grid gap-2 text-sm">
          {section.kind === 'CATEGORIES' ? (
            <CampaignTaxonomyPicker
              taxonomy={taxonomy ?? { categories: [], brands: [] }}
              kind="categories"
              selected={slugs}
              onChange={selectSlugs}
              max={24}
              campaignId={campaignId}
            />
          ) : (
            <CampaignProductSearch
              selected={slugs}
              campaignId={campaignId}
              withinCampaign
              taxonomy={taxonomy}
              max={24}
              onSelect={(slug) => selectSlugs(addCampaignSelection(slugs, slug, 24))}
              onRemove={(slug) => selectSlugs(slugs.filter((item) => item !== slug))}
            />
          )}
          {section.kind !== 'PICKS' && (
            <span className="text-xs">اگر خالی بماند، از مجموعهٔ کمپین انتخاب می‌شود.</span>
          )}
        </div>
      )}

      {entrySection && (
        <div className="space-y-2">
          {entries.map(({ title, body, maxPriceToman, actionPath }, index) => (
            <div
              key={index}
              className="grid gap-2 rounded-lg border border-[var(--admin-color-border)] p-3"
            >
              <label className="grid gap-1 text-sm">
                عنوان
                <Input
                  required
                  value={title}
                  maxLength={80}
                  onChange={(e) =>
                    update({
                      ...section,
                      entries: entries.map((entry, row) =>
                        row === index ? { ...entry, title: e.currentTarget.value } : entry,
                      ),
                    })
                  }
                />
              </label>
              {section.kind === 'BUDGET' ? (
                <label className="grid gap-1 text-sm">
                  سقف قیمت (تومان)
                  <Input
                    type="number"
                    required
                    min={1}
                    max={2_147_483_647}
                    value={maxPriceToman ?? ''}
                    onChange={(e) =>
                      update({
                        ...section,
                        entries: entries.map((entry, row) =>
                          row === index
                            ? {
                                ...entry,
                                maxPriceToman: e.currentTarget.value
                                  ? e.currentTarget.valueAsNumber
                                  : undefined,
                              }
                            : entry,
                        ),
                      })
                    }
                  />
                </label>
              ) : (
                <label className="grid gap-1 text-sm">
                  {section.kind === 'FAQ' ? 'پاسخ' : 'توضیح'}
                  <Textarea
                    maxLength={500}
                    value={body ?? ''}
                    rows={2}
                    onChange={(e) =>
                      update({
                        ...section,
                        entries: entries.map((entry, row) =>
                          row === index
                            ? {
                                ...entry,
                                body: e.currentTarget.value || undefined,
                              }
                            : entry,
                        ),
                      })
                    }
                  />
                </label>
              )}
              {section.kind === 'OFFERS' && (
                <label className="grid gap-1 text-sm">
                  مسیر مجموعهٔ مکمل
                  <Input
                    dir="ltr"
                    maxLength={220}
                    placeholder="/campaigns/..."
                    value={actionPath ?? ''}
                    onChange={(e) =>
                      update({
                        ...section,
                        entries: entries.map((entry, row) =>
                          row === index
                            ? {
                                ...entry,
                                actionPath: e.currentTarget.value || undefined,
                              }
                            : entry,
                        ),
                      })
                    }
                  />
                </label>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  update({ ...section, entries: entries.filter((_, row) => row !== index) })
                }
              >
                حذف ردیف
              </Button>
            </div>
          ))}
          {entries.length < 12 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => update({ ...section, entries: [...entries, { title: '' }] })}
            >
              افزودن ردیف
            </Button>
          )}
        </div>
      )}
      {section.kind === 'HERO' && (
        <div className="space-y-3">
          {slides.map((slide, index) => (
            <div key={index} className="space-y-2">
              <SlideFields
                slide={slide}
                assets={assets}
                uploaded={uploaded}
                onPendingChange={onPendingChange}
                update={(next) =>
                  update({
                    ...section,
                    slides: slides.map((row, slot) => (slot === index ? next : row)),
                  })
                }
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  update({ ...section, slides: slides.filter((_, slot) => slot !== index) })
                }
              >
                حذف اسلاید
              </Button>
            </div>
          ))}
          {slides.length < 5 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                update({ ...section, slides: [...slides, { title: '', mediaId: '' }] })
              }
            >
              افزودن اسلاید
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
