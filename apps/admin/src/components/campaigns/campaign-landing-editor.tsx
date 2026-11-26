'use client';

import type { components } from '@hamidian/contracts';
import { useRouter } from 'next/navigation';
import { useEffect, useEffectEvent, useRef, useState, type FormEvent } from 'react';

import { Alert } from '@/components/ui/alert';
import { SiteMediaField } from '@/components/site-settings/site-media-field';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DualCalendarPicker } from '@/components/ui/dual-calendar-picker';
import { Input, Textarea } from '@/components/ui/form-control';
import { FormField } from '@/components/ui/form-field';
import { MoneyInput } from '@/components/ui/money-input';
import { Select } from '@/components/ui/select';
import { campaignError } from '@/lib/campaigns/campaign-api-errors';
import type { CampaignDetail } from '@/lib/campaigns/campaign-model';
import { addCampaignSelection, useCampaignTaxonomy } from '@/lib/campaigns/campaign-selection';
import {
  formatAdminInteger,
  parseAdminMoneyInput,
  toAsciiDigits,
  toPersianDigits,
} from '@/lib/presentation/formatters';
import { CampaignCollectionPicker } from './campaign-collection-picker';
import {
  CampaignPlacementStyleFields,
  readCampaignPlacementStyle,
} from './campaign-placement-style-fields';
import { CampaignProductSearch } from './campaign-product-search';
import { CampaignTaxonomyPicker } from './campaign-taxonomy-picker';

type Draft = components['schemas']['CampaignLandingDraftDto'];
type Editor = components['schemas']['CampaignLandingEditorDto'];
type AttributeMode = 'choices' | 'range';
type Slot = Draft['placements'][number]['slot'];
type PlacementMedia = components['schemas']['CampaignPlacementMediaDto'];
type MediaKey = 'media' | 'mobileMedia' | 'stillMedia';

const assetFields: ReadonlyArray<{ key: MediaKey; label: string }> = [
  { key: 'media', label: 'تصویر دسکتاپ' },
  { key: 'mobileMedia', label: 'تصویر موبایل' },
  { key: 'stillMedia', label: 'تصویر ثابت جایگزین GIF' },
];
const navigationEffects = [
  { value: 'SOLID', label: 'رنگ ثابت' },
  { value: 'GRADIENT', label: 'گرادیان ثابت' },
  { value: 'ANIMATED', label: 'گرادیان با حرکت کوتاه' },
] as const;

const slotLabels: Record<Slot, string> = {
  HOME: 'ردیف قدیمی صفحهٔ نخست (خارج از نمایش فروشگاه)',
  CATEGORY: 'صفحهٔ دسته',
  PRODUCT: 'صفحهٔ محصول',
  COUNTDOWN: 'نوار سراسری شمارش معکوس',
  NAVIGATION: 'منوی بالای فروشگاه',
};
const slots = Object.keys(slotLabels) as Slot[];
const labels = {
  FILTERED: 'انتخاب پویا بر اساس قواعد کاتالوگ',
  MANUAL: 'فهرست ثابت محصولات انتخابی',
};
const seoOptions = [
  { value: 'TEMPORARY', label: 'صفحهٔ موقت' },
  { value: 'RECURRING', label: 'مناسبت تکرارشونده' },
];
const collectionOptions = Object.entries(labels).map(([value, label]) => ({ value, label }));
const attributeOptions = [
  { value: 'choices', label: 'گزینه‌ای' },
  { value: 'range', label: 'بازهٔ عددی' },
];

function splitSlugs(value: string) {
  return [
    ...new Set(
      value
        .split(/[\n,،]/)
        .map((key) => key.trim())
        .filter(Boolean),
    ),
  ];
}

function readOptionalNumber(value: string) {
  if (!value) return undefined;
  const parsed = Number(toAsciiDigits(value).replace('٫', '.'));
  if (!Number.isFinite(parsed)) throw new Error('مقادیر عددی فیلترها را بررسی کنید.');
  return parsed;
}

function attributesFrom(filters?: Draft['filters']) {
  return (filters?.attributes ?? []).map((filter, key) => ({
    key,
    mode: (filter.values?.length ? 'choices' : 'range') as AttributeMode,
    filter,
  }));
}

export function CampaignLandingEditor({
  campaign,
  editor,
  canWrite,
  onPreviewChange,
  view = 'all',
}: {
  campaign: CampaignDetail;
  editor: Editor;
  canWrite: boolean;
  onPreviewChange?: (draft: Draft | null) => void;
  view?: 'all' | 'collection' | 'details' | 'placements';
}) {
  const router = useRouter();
  const draft = editor.landing;
  const editable = canWrite && campaign.status === 'DRAFT';
  const showDetails = view !== 'placements';
  const showCollection = view === 'all' || view === 'collection';
  const showPlacements = view === 'all' || view === 'placements';
  const title =
    view === 'placements'
      ? 'منو، اعلان و جایگاه‌ها'
      : view === 'details'
        ? 'اطلاعات لندینگ'
        : 'صفحه و مجموعهٔ کمپین';
  const [mode, setMode] = useState<Draft['collectionMode']>(draft?.collectionMode ?? 'FILTERED');
  const [filterDefaults, setFilterDefaults] = useState(draft?.filters);
  const [filterVersion, setFilterVersion] = useState(0);
  const [manualProducts, setManualProducts] = useState(draft?.manualProductSlugs ?? []);
  const [categories, setCategories] = useState(draft?.filters.categories ?? []);
  const [brands, setBrands] = useState(draft?.filters.brands ?? []);
  const taxonomy = useCampaignTaxonomy(showCollection || showPlacements);
  const [seoMode, setSeoMode] = useState<Draft['seoMode']>(draft?.seoMode ?? 'TEMPORARY');
  const [enabledSlots, setEnabledSlots] = useState<Slot[]>(
    draft?.placements.map(({ slot }) => slot) ?? [],
  );
  const [placementMedia, setPlacementMedia] = useState<Partial<Record<Slot, PlacementMedia>>>(() =>
    Object.fromEntries((editor.placementMedia ?? []).map((entry) => [entry.slot, entry])),
  );
  const [placementTargets, setPlacementTargets] = useState<Partial<Record<Slot, string>>>(() =>
    Object.fromEntries(
      (draft?.placements ?? []).flatMap(({ slot, targetSlug }) =>
        targetSlug ? [[slot, targetSlug]] : [],
      ),
    ),
  );
  const [altTexts, setAltTexts] = useState<Record<string, string>>({});
  const [uploads, setUploads] = useState<string[]>([]);
  function changeMedia(slot: Slot, key: MediaKey, media: PlacementMedia[MediaKey]) {
    setPlacementMedia((current) => ({
      ...current,
      [slot]: {
        slot,
        media: null,
        mobileMedia: null,
        stillMedia: null,
        ...current[slot],
        [key]: media,
      },
    }));
  }
  const [attributeRows, setAttributeRows] = useState(() => attributesFrom(draft?.filters));
  const nextKey = useRef(attributeRows.length);
  const [busy, setBusy] = useState<'save' | 'preview' | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [formChanges, setFormChanges] = useState(0);
  const publishDraft = useEffectEvent(() => {
    if (!onPreviewChange) return;
    if (!editable) return onPreviewChange(draft);
    const form = formRef.current;
    if (!form || busy || uploads.length || !form.checkValidity()) return onPreviewChange(null);
    try {
      onPreviewChange(currentDraft(form));
    } catch {
      onPreviewChange(null);
    }
  });

  useEffect(() => {
    publishDraft();
  }, [
    attributeRows,
    brands,
    categories,
    draft,
    editable,
    enabledSlots,
    filterDefaults,
    formChanges,
    manualProducts,
    mode,
    placementMedia,
    placementTargets,
    seoMode,
    uploads,
    busy,
    view,
  ]);

  function applyCollection(filters: Draft['filters']) {
    const rows = attributesFrom(filters);
    setFilterDefaults(filters);
    setFilterVersion((version) => version + 1);
    setCategories(filters.categories ?? []);
    setBrands(filters.brands ?? []);
    setAttributeRows(rows);
    nextKey.current = rows.length;
    setCount(null);
  }

  function currentDraft(form: HTMLFormElement): Draft {
    const values = new FormData(form);
    const text = (field: string) => String(values.get(field) ?? '').trim();
    const minPriceToman = parseAdminMoneyInput(text('minPrice')) ?? undefined;
    const maxPriceToman = parseAdminMoneyInput(text('maxPrice')) ?? undefined;
    const filters: Draft['filters'] = {
      minimumQuantity: readOptionalNumber(text('minimumQuantity')) ?? 1,
    };
    if (showCollection && mode === 'FILTERED') {
      Object.assign(filters, {
        categories,
        brands,
        minPriceToman,
        maxPriceToman,
        sort: filterDefaults?.sort,
        attributes: attributeRows.map(({ key, mode: attributeMode }) => ({
          code: text(`attribute-code-${key}`),
          ...(attributeMode === 'choices'
            ? { values: splitSlugs(text(`attribute-values-${key}`)) }
            : {
                min: readOptionalNumber(text(`attribute-min-${key}`)),
                max: readOptionalNumber(text(`attribute-max-${key}`)),
              }),
        })),
      });
    }
    const details = {
      title: showDetails ? text('title') : (draft?.title ?? campaign.name),
      story: showDetails ? text('story') : (draft?.story ?? campaign.message),
    };
    return {
      slug: draft?.slug ?? text('slug'),
      seoMode,
      ...details,
      collectionMode: showCollection ? mode : (draft?.collectionMode ?? mode),
      filters: showCollection ? filters : (draft?.filters ?? filters),
      manualProductSlugs: showCollection
        ? mode === 'MANUAL'
          ? manualProducts
          : []
        : (draft?.manualProductSlugs ?? []),
      placements: showPlacements
        ? enabledSlots.map((slot) => ({
            slot,
            priority: readOptionalNumber(text(`priority-${slot}`)) ?? 0,
            targetSlug: placementTargets[slot] || null,
            startsTehran: text(`start-${slot}`) || null,
            endsTehran: text(`end-${slot}`) || null,
            appearance:
              slot === 'NAVIGATION'
                ? {
                    navigationEffect: (
                      navigationEffects.find(({ value }) => value === text('navigation-effect')) ??
                      navigationEffects[0]
                    ).value,
                    ...readCampaignPlacementStyle(slot, text),
                  }
                : {
                    mediaId: placementMedia[slot]?.media?.id ?? null,
                    mobileMediaId: placementMedia[slot]?.mobileMedia?.id ?? null,
                    stillMediaId: placementMedia[slot]?.stillMedia?.id ?? null,
                    ...(slot === 'COUNTDOWN'
                      ? {
                          desktopHeight: readOptionalNumber(text('countdown-desktop-height')),
                          mobileHeight: readOptionalNumber(text('countdown-mobile-height')),
                          ...readCampaignPlacementStyle(slot, text),
                        }
                      : {}),
                  },
          }))
        : (draft?.placements ?? []),
    };
  }

  async function submit(action: 'preview' | 'save', form?: HTMLFormElement | null) {
    if (busy || uploads.length || (editable && !form?.reportValidity())) return;
    setBusy(action);
    setCount(null);
    setError(null);
    try {
      const body = editable && form ? currentDraft(form) : draft;
      if (!body) return;
      if (
        editable &&
        body.placements.some(
          ({ startsTehran, endsTehran }) =>
            (startsTehran ?? campaign.startsTehran) >= (endsTehran ?? campaign.endsTehran),
        )
      ) {
        setError('زمان پایان هر جایگاه باید پس از زمان آغاز آن باشد.');
        return;
      }
      const endpoint = `/api/campaigns/${campaign.id}/landing`;
      const response = await fetch(action === 'preview' ? `${endpoint}/preview` : endpoint, {
        method: action === 'preview' ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          action === 'preview' ? body : { ...body, expectedRevision: editor.revision },
        ),
      });
      if (!response.ok) {
        setError(await campaignError(response));
        return;
      }
      if (action === 'preview') {
        const preview = (await response.json()) as { total: number };
        setCount(preview.total);
      } else {
        router.refresh();
      }
    } catch (caught) {
      setError(
        caught instanceof Error && caught.message.startsWith('مقادیر')
          ? caught.message
          : 'اتصال برای انجام درخواست برقرار نشد.',
      );
    } finally {
      setBusy(null);
    }
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submit('save', event.currentTarget);
  }

  if (!editable && !draft) {
    return (
      <Card title={title}>
        <p className="text-sm">برای این کمپین صفحه‌ای ثبت نشده است.</p>
      </Card>
    );
  }

  const countLabel =
    count === null
      ? null
      : count > 0
        ? `${formatAdminInteger(count)} محصول قابل فروش پیدا شد.`
        : 'با قواعد فعلی محصول قابل فروشی وجود ندارد.';

  if (!editable && draft) {
    return (
      <Card title={title}>
        <div className="grid gap-3 text-sm">
          <p>
            {draft.title} · {labels[draft.collectionMode]}
          </p>
          <p dir="ltr" className="w-fit break-all">
            /campaigns/{draft.slug}
          </p>
          <p className="whitespace-pre-line">{draft.story}</p>
          <p>
            {draft.placements.length
              ? draft.placements.map(({ slot }) => slotLabels[slot]).join('، ')
              : 'جایگاه بنر تنظیم نشده است.'}
          </p>
          {error && <Alert tone="danger">{error}</Alert>}
          {countLabel && <Alert tone={count ? 'success' : 'warning'}>{countLabel}</Alert>}
          <Button
            className="w-fit"
            variant="outline"
            loading={busy === 'preview'}
            onClick={() => void submit('preview')}
          >
            شمارش محصولات فعلی
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card
      title={title}
      description={
        showCollection ? 'پیش از تأیید می‌توانید تعداد محصولات قابل فروش را ببینید.' : undefined
      }
    >
      <form
        ref={formRef}
        onSubmit={save}
        className="space-y-4"
        onChange={() => {
          setCount(null);
          if (onPreviewChange) setFormChanges((value) => value + 1);
        }}
      >
        <fieldset disabled={Boolean(busy)} className="grid min-w-0 gap-4 sm:grid-cols-2">
          {showDetails && (
            <>
              <FormField
                id="landing-slug"
                label="اسلاگ صفحه"
                hint="بعد از ذخیره ثابت است. برای مناسبت تکرارشونده می‌توان همین آدرس را در نوبت بعد استفاده کرد."
                required
              >
                {(control) => (
                  <Input
                    {...control}
                    name="slug"
                    dir="ltr"
                    pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                    maxLength={64}
                    defaultValue={draft?.slug ?? campaign.slug}
                    readOnly={Boolean(draft)}
                    required
                  />
                )}
              </FormField>
              <FormField id="landing-seo" label="نوع صفحه">
                {(control) => (
                  <Select
                    {...control}
                    value={seoMode}
                    disabled={Boolean(draft || busy)}
                    options={seoOptions}
                    onValueChange={(value) => setSeoMode(value as Draft['seoMode'])}
                  />
                )}
              </FormField>
              <FormField id="landing-title" label="عنوان صفحه" required className="sm:col-span-2">
                {(control) => (
                  <Input
                    {...control}
                    name="title"
                    defaultValue={draft?.title ?? campaign.name}
                    maxLength={150}
                    required
                  />
                )}
              </FormField>
              <FormField
                id="landing-story"
                label="داستان یا توضیح کمپین"
                required
                className="sm:col-span-2"
              >
                {(control) => (
                  <Textarea
                    {...control}
                    name="story"
                    maxLength={3000}
                    defaultValue={draft?.story ?? (view === 'collection' ? campaign.message : '')}
                    required
                  />
                )}
              </FormField>
            </>
          )}
          {showCollection && (
            <>
              <FormField id="landing-mode" label="روش انتخاب محصولات">
                {(control) => (
                  <Select
                    {...control}
                    value={mode}
                    disabled={Boolean(busy)}
                    options={collectionOptions}
                    onValueChange={(value) => {
                      setMode(value as Draft['collectionMode']);
                      setCount(null);
                    }}
                  />
                )}
              </FormField>
              <FormField
                key={`stock-${filterVersion}`}
                id="landing-stock"
                label="حداقل موجودی قابل فروش"
                hint="از ۱ تا ۹۹۹"
              >
                {(control) => (
                  <Input
                    {...control}
                    name="minimumQuantity"
                    inputMode="numeric"
                    maxLength={3}
                    defaultValue={toPersianDigits(filterDefaults?.minimumQuantity ?? 1)}
                    required
                  />
                )}
              </FormField>
              {mode === 'MANUAL' ? (
                <div className="space-y-2 sm:col-span-2">
                  <p className="text-xs text-[var(--admin-color-muted)]">
                    محصولات به ترتیب انتخاب در فهرست ثابت ذخیره می‌شوند.
                  </p>
                  <CampaignProductSearch
                    selected={manualProducts}
                    campaignId={campaign.id}
                    withinCampaign
                    taxonomy={taxonomy.data}
                    max={48}
                    disabled={Boolean(busy)}
                    onSelect={(slug) => {
                      setManualProducts((current) => addCampaignSelection(current, slug, 48));
                      setCount(null);
                    }}
                    onRemove={(slug) => {
                      setManualProducts((current) => current.filter((item) => item !== slug));
                      setCount(null);
                    }}
                  />
                </div>
              ) : (
                <>
                  <div className="space-y-2 sm:col-span-2">
                    <CampaignCollectionPicker
                      campaignId={campaign.id}
                      disabled={Boolean(busy)}
                      onApply={applyCollection}
                    />
                    {taxonomy.loading && (
                      <p role="status" className="text-sm">
                        در حال دریافت دسته‌ها و برندها…
                      </p>
                    )}
                    {taxonomy.failed && (
                      <Alert tone="danger">
                        دریافت دسته‌ها و برندها ممکن نشد.{' '}
                        <Button size="sm" variant="outline" onClick={taxonomy.retry}>
                          تلاش دوباره
                        </Button>
                      </Alert>
                    )}
                  </div>
                  <CampaignTaxonomyPicker
                    taxonomy={taxonomy.data ?? { categories: [], brands: [] }}
                    kind="categories"
                    selected={categories}
                    onChange={(selected) => {
                      setCategories(selected);
                      setCount(null);
                    }}
                    max={16}
                    campaignId={campaign.id}
                    disabled={Boolean(busy)}
                  />
                  <CampaignTaxonomyPicker
                    taxonomy={taxonomy.data ?? { categories: [], brands: [] }}
                    kind="brands"
                    selected={brands}
                    campaignId={campaign.id}
                    onChange={(selected) => {
                      setBrands(selected);
                      setCount(null);
                    }}
                    max={16}
                    disabled={Boolean(busy)}
                  />
                  <FormField
                    key={`min-${filterVersion}`}
                    id="landing-min"
                    label="حداقل قیمت (تومان)"
                  >
                    {(control) => (
                      <MoneyInput
                        {...control}
                        name="minPrice"
                        defaultValue={filterDefaults?.minPriceToman}
                      />
                    )}
                  </FormField>
                  <FormField
                    key={`max-${filterVersion}`}
                    id="landing-max"
                    label="حداکثر قیمت (تومان)"
                  >
                    {(control) => (
                      <MoneyInput
                        {...control}
                        name="maxPrice"
                        defaultValue={filterDefaults?.maxPriceToman}
                      />
                    )}
                  </FormField>
                  <fieldset
                    key={filterVersion}
                    className="min-w-0 space-y-4 rounded-lg border border-[var(--admin-color-border)] p-3 sm:col-span-2"
                  >
                    <legend className="px-2 text-sm font-semibold">فیلتر ویژگی‌ها</legend>
                    {attributeRows.map(({ key, mode: attributeMode, filter }) => (
                      <div className="grid gap-3 sm:grid-cols-2" key={key}>
                        <FormField id={`attribute-code-${key}`} label="کد ویژگی" required>
                          {(control) => (
                            <Input
                              {...control}
                              name={control.id}
                              dir="ltr"
                              defaultValue={filter.code}
                              maxLength={64}
                              required
                            />
                          )}
                        </FormField>
                        <FormField id={`attribute-type-${key}`} label="نوع فیلتر">
                          {(control) => (
                            <Select
                              {...control}
                              options={attributeOptions}
                              value={attributeMode}
                              disabled={Boolean(busy)}
                              onValueChange={(value) => {
                                setAttributeRows((rows) =>
                                  rows.map((row) =>
                                    row.key === key
                                      ? { ...row, mode: value as AttributeMode }
                                      : row,
                                  ),
                                );
                                setCount(null);
                              }}
                            />
                          )}
                        </FormField>
                        {attributeMode === 'choices' ? (
                          <FormField
                            id={`attribute-values-${key}`}
                            label="کد گزینه‌ها"
                            hint="با ویرگول جدا کنید."
                            required
                          >
                            {(control) => (
                              <Input
                                {...control}
                                name={control.id}
                                dir="ltr"
                                defaultValue={filter.values?.join(', ')}
                                required
                              />
                            )}
                          </FormField>
                        ) : (
                          <>
                            <FormField id={`attribute-min-${key}`} label="حداقل">
                              {(control) => (
                                <Input
                                  {...control}
                                  name={control.id}
                                  defaultValue={filter.min}
                                  inputMode="decimal"
                                />
                              )}
                            </FormField>
                            <FormField id={`attribute-max-${key}`} label="حداکثر">
                              {(control) => (
                                <Input
                                  {...control}
                                  name={control.id}
                                  defaultValue={filter.max}
                                  inputMode="decimal"
                                />
                              )}
                            </FormField>
                          </>
                        )}
                        <Button
                          className="w-fit"
                          variant="ghost"
                          onClick={() => {
                            setAttributeRows((rows) => rows.filter((row) => row.key !== key));
                            setCount(null);
                          }}
                        >
                          حذف ویژگی
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      disabled={attributeRows.length >= 8}
                      onClick={() => {
                        const key = nextKey.current++;
                        setAttributeRows((rows) => [
                          ...rows,
                          { key, mode: 'choices', filter: { code: '' } },
                        ]);
                        setCount(null);
                      }}
                    >
                      افزودن ویژگی
                    </Button>
                  </fieldset>
                </>
              )}
            </>
          )}
          {showPlacements && (
            <fieldset className="min-w-0 space-y-4 rounded-lg border border-[var(--admin-color-border)] p-3 sm:col-span-2">
              <legend className="px-2 text-sm font-semibold">منو، اعلان و جایگاه‌های بنر</legend>
              <p className="text-xs text-[var(--admin-color-muted)]">
                برای نمایش، گزینهٔ بنر را در پیش‌نویس اصلی کمپین هم فعال کنید. زمان‌های خالی از
                بازهٔ کمپین خوانده می‌شوند.
              </p>
              <p className="text-xs text-[var(--admin-color-muted)]">
                برای معرفی کمپین در صفحهٔ نخست، پیوند لندینگ را در اسلایدشوی اصلی فروشگاه قرار دهید.
              </p>
              {slots.map((slot) => {
                const saved = draft?.placements.find((item) => item.slot === slot);
                if (slot === 'HOME' && !saved) return null;
                return (
                  <div key={slot} className="grid gap-3">
                    <label className="flex items-center gap-2 text-sm font-semibold">
                      <input
                        type="checkbox"
                        checked={enabledSlots.includes(slot)}
                        onChange={(event) => {
                          const checked = event.currentTarget.checked;
                          setEnabledSlots((current) =>
                            checked ? [...current, slot] : current.filter((item) => item !== slot),
                          );
                        }}
                      />
                      {slotLabels[slot]}
                    </label>
                    {enabledSlots.includes(slot) && (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {(slot === 'CATEGORY' || slot === 'PRODUCT') && (
                          <div className="space-y-2 sm:col-span-2">
                            <p className="text-xs text-[var(--admin-color-muted)]">
                              بدون انتخاب مقصد، جایگاه برای همهٔ صفحات این نوع فعال است.
                            </p>
                            {slot === 'CATEGORY' ? (
                              <CampaignTaxonomyPicker
                                taxonomy={taxonomy.data ?? { categories: [], brands: [] }}
                                kind="categories"
                                selected={
                                  placementTargets.CATEGORY ? [placementTargets.CATEGORY] : []
                                }
                                onChange={(selection) =>
                                  setPlacementTargets((current) => ({
                                    ...current,
                                    CATEGORY: selection[0],
                                  }))
                                }
                                max={1}
                                categoryMode="direct"
                                disabled={Boolean(busy)}
                              />
                            ) : (
                              <CampaignProductSearch
                                selected={
                                  placementTargets.PRODUCT ? [placementTargets.PRODUCT] : []
                                }
                                taxonomy={taxonomy.data}
                                campaignId={campaign.id}
                                max={1}
                                disabled={Boolean(busy)}
                                onSelect={(slug) =>
                                  setPlacementTargets((current) => ({ ...current, PRODUCT: slug }))
                                }
                                onRemove={() =>
                                  setPlacementTargets((current) => ({
                                    ...current,
                                    PRODUCT: undefined,
                                  }))
                                }
                              />
                            )}
                          </div>
                        )}
                        <FormField id={`priority-${slot}`} label="اولویت" hint="از ۰ تا ۱۰۰">
                          {(control) => (
                            <Input
                              {...control}
                              name={control.id}
                              inputMode="numeric"
                              defaultValue={saved?.priority ?? campaign.bannerPriority}
                            />
                          )}
                        </FormField>
                        <DualCalendarPicker
                          label="زمان آغاز جایگاه"
                          name={`start-${slot}`}
                          defaultValue={saved?.startsTehran ?? ''}
                        />
                        <DualCalendarPicker
                          label="زمان پایان جایگاه"
                          name={`end-${slot}`}
                          defaultValue={saved?.endsTehran ?? ''}
                        />
                        {slot === 'NAVIGATION' && (
                          <FormField id="navigation-effect" label="ظاهر پایهٔ منو">
                            {(control) => (
                              <Select
                                {...control}
                                name={control.id}
                                options={navigationEffects}
                                defaultValue={saved?.appearance?.navigationEffect ?? 'SOLID'}
                              />
                            )}
                          </FormField>
                        )}
                        {(slot === 'NAVIGATION' || slot === 'COUNTDOWN') && (
                          <CampaignPlacementStyleFields slot={slot} saved={saved?.appearance} />
                        )}
                        {slot === 'COUNTDOWN' && (
                          <>
                            {(
                              [
                                [
                                  'countdown-desktop-height',
                                  'حداقل ارتفاع دسکتاپ (پیکسل)',
                                  saved?.appearance?.desktopHeight,
                                ],
                                [
                                  'countdown-mobile-height',
                                  'حداقل ارتفاع موبایل (پیکسل)',
                                  saved?.appearance?.mobileHeight,
                                ],
                              ] as const
                            ).map(([id, label, value]) => (
                              <FormField key={id} id={id} label={label} hint="از ۴۸ تا ۳۲۰">
                                {(control) => (
                                  <Input
                                    {...control}
                                    name={control.id}
                                    type="number"
                                    min={48}
                                    max={320}
                                    defaultValue={value ?? undefined}
                                  />
                                )}
                              </FormField>
                            ))}
                            <p className="text-xs text-[var(--admin-color-muted)] sm:col-span-2">
                              با خالی گذاشتن متن و مسیر دکمه، تنظیم دکمهٔ کمپین یا پیوند لندینگ
                              استفاده می‌شود.
                            </p>
                          </>
                        )}
                        {slot !== 'NAVIGATION' &&
                          assetFields.map(({ key, label }) => {
                            const id = `${slot}-${key}`;
                            const media = placementMedia[slot]?.[key] ?? null;
                            const altText = altTexts[id] ?? media?.altText ?? '';
                            return (
                              <div key={key} className="space-y-2">
                                <FormField id={id} label={`متن جایگزین برای بارگذاری ${label}`}>
                                  {(control) => (
                                    <Input
                                      {...control}
                                      value={altText}
                                      maxLength={255}
                                      onChange={(event) => {
                                        const value = event.currentTarget.value;
                                        setAltTexts((current) => ({ ...current, [id]: value }));
                                      }}
                                    />
                                  )}
                                </FormField>
                                <SiteMediaField
                                  label={label}
                                  media={media}
                                  altText={altText}
                                  hint={
                                    key === 'stillMedia'
                                      ? 'در صورت استفاده از GIF، تصویر ثابت الزامی است.'
                                      : 'GIF حداکثر ۴ مگابایت یا تصویر ثابت'
                                  }
                                  allowCampaignGif={key !== 'stillMedia'}
                                  uploadUrl="/api/campaigns/media"
                                  onUploaded={(file) => changeMedia(slot, key, file)}
                                  onClear={() => changeMedia(slot, key, null)}
                                  onPendingChange={(pending) =>
                                    setUploads((current) =>
                                      pending
                                        ? [...current, id]
                                        : current.filter((item) => item !== id),
                                    )
                                  }
                                />
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </div>
                );
              })}
            </fieldset>
          )}
        </fieldset>
        {error && <Alert tone="danger">{error}</Alert>}
        {countLabel && <Alert tone={count ? 'success' : 'warning'}>{countLabel}</Alert>}
        <div className="flex flex-wrap gap-2">
          <Button
            type="submit"
            loading={busy === 'save'}
            disabled={busy === 'preview' || uploads.length > 0}
          >
            {view === 'placements'
              ? 'ذخیرهٔ جایگاه‌ها'
              : view === 'details'
                ? 'ذخیرهٔ لندینگ'
                : 'ذخیرهٔ صفحه و مجموعه'}
          </Button>
          {showCollection && (
            <Button
              variant="outline"
              loading={busy === 'preview'}
              disabled={busy === 'save' || uploads.length > 0}
              onClick={() => void submit('preview', formRef.current)}
            >
              پیش‌نمایش تعداد محصولات
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}
