'use client';

import type { components } from '@hamidian/contracts';
import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input, Textarea } from '@/components/ui/form-control';
import { FormField } from '@/components/ui/form-field';
import { MoneyInput } from '@/components/ui/money-input';
import { Select } from '@/components/ui/select';
import { campaignError } from '@/lib/campaigns/campaign-api-errors';
import type { CampaignDetail } from '@/lib/campaigns/campaign-model';
import {
  formatAdminInteger,
  parseAdminMoneyInput,
  toAsciiDigits,
  toPersianDigits,
} from '@/lib/presentation/formatters';

type Draft = components['schemas']['CampaignLandingDraftDto'];
type Editor = components['schemas']['CampaignLandingEditorDto'];
type AttributeMode = 'choices' | 'range';
type Slot = Draft['placements'][number]['slot'];

const slotLabels: Record<Slot, string> = {
  HOME: 'صفحهٔ نخست',
  CATEGORY: 'صفحهٔ دسته',
  PRODUCT: 'صفحهٔ محصول',
};
const slots = Object.keys(slotLabels) as Slot[];
const labels = {
  FILTERED: 'طبق قواعد کاتالوگ',
  MANUAL: 'انتخاب دستی',
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

export function CampaignLandingEditor({
  campaign,
  editor,
  canWrite,
}: {
  campaign: CampaignDetail;
  editor: Editor;
  canWrite: boolean;
}) {
  const router = useRouter();
  const draft = editor.landing;
  const editable = canWrite && campaign.status === 'DRAFT';
  const [mode, setMode] = useState<Draft['collectionMode']>(draft?.collectionMode ?? 'FILTERED');
  const [seoMode, setSeoMode] = useState<Draft['seoMode']>(draft?.seoMode ?? 'TEMPORARY');
  const [enabledSlots, setEnabledSlots] = useState<Slot[]>(
    draft?.placements.map(({ slot }) => slot) ?? [],
  );
  const [attributeRows, setAttributeRows] = useState(() =>
    (draft?.filters.attributes ?? []).map((filter, key) => ({
      key,
      mode: (filter.values?.length ? 'choices' : 'range') as AttributeMode,
      filter,
    })),
  );
  const nextKey = useRef(8);
  const [busy, setBusy] = useState<'save' | 'preview' | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function currentDraft(form: HTMLFormElement): Draft {
    const values = new FormData(form);
    const text = (field: string) => String(values.get(field) ?? '').trim();
    const minPriceToman = parseAdminMoneyInput(text('minPrice')) ?? undefined;
    const maxPriceToman = parseAdminMoneyInput(text('maxPrice')) ?? undefined;
    const filters: Draft['filters'] = {
      minimumQuantity: readOptionalNumber(text('minimumQuantity')) ?? 1,
    };
    if (mode === 'FILTERED') {
      Object.assign(filters, {
        categories: splitSlugs(text('categories')),
        brands: splitSlugs(text('brands')),
        minPriceToman,
        maxPriceToman,
        sort: draft?.filters.sort,
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
    return {
      slug: draft?.slug ?? text('slug'),
      seoMode,
      title: text('title'),
      story: text('story'),
      collectionMode: mode,
      filters,
      manualProductSlugs: mode === 'MANUAL' ? splitSlugs(text('products')) : [],
      placements: enabledSlots.map((slot) => ({
        slot,
        priority: readOptionalNumber(text(`priority-${slot}`)) ?? 0,
        targetSlug: text(`target-${slot}`) || null,
        startsTehran: text(`start-${slot}`) || null,
        endsTehran: text(`end-${slot}`) || null,
      })),
    };
  }

  async function submit(action: 'preview' | 'save', form?: HTMLFormElement | null) {
    if (busy || (editable && !form?.reportValidity())) return;
    setBusy(action);
    setCount(null);
    setError(null);
    try {
      const body = editable && form ? currentDraft(form) : draft;
      if (!body) return;
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
      <Card title="صفحه و مجموعهٔ کمپین">
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
      <Card title="صفحه و مجموعهٔ کمپین">
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
      title="صفحه و مجموعهٔ کمپین"
      description="قواعد انتخاب و بنرها را در پیش‌نویس تنظیم کنید. پیش از تأیید می‌توانید تعداد محصولات قابل فروش را ببینید."
    >
      <form ref={formRef} onSubmit={save} className="space-y-4" onChange={() => setCount(null)}>
        <fieldset disabled={Boolean(busy)} className="grid gap-4 sm:grid-cols-2">
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
                defaultValue={draft?.story ?? ''}
                required
              />
            )}
          </FormField>
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
          <FormField id="landing-stock" label="حداقل موجودی قابل فروش" hint="از ۱ تا ۹۹۹">
            {(control) => (
              <Input
                {...control}
                name="minimumQuantity"
                inputMode="numeric"
                maxLength={3}
                defaultValue={toPersianDigits(draft?.filters.minimumQuantity ?? 1)}
                required
              />
            )}
          </FormField>
          {mode === 'MANUAL' ? (
            <FormField
              id="landing-products"
              label="اسلاگ محصولات"
              hint="به ترتیب نمایش، در خط‌های جدا یا با ویرگول."
              required
              className="sm:col-span-2"
            >
              {(control) => (
                <Textarea
                  {...control}
                  name="products"
                  dir="ltr"
                  defaultValue={draft?.manualProductSlugs.join('\n')}
                  required
                />
              )}
            </FormField>
          ) : (
            <>
              <FormField id="landing-categories" label="اسلاگ دسته‌ها" hint="با ویرگول جدا کنید.">
                {(control) => (
                  <Input
                    {...control}
                    name="categories"
                    dir="ltr"
                    defaultValue={draft?.filters.categories?.join(', ')}
                  />
                )}
              </FormField>
              <FormField id="landing-brands" label="اسلاگ برندها" hint="با ویرگول جدا کنید.">
                {(control) => (
                  <Input
                    {...control}
                    name="brands"
                    dir="ltr"
                    defaultValue={draft?.filters.brands?.join(', ')}
                  />
                )}
              </FormField>
              <FormField id="landing-min" label="حداقل قیمت (تومان)">
                {(control) => (
                  <MoneyInput
                    {...control}
                    name="minPrice"
                    defaultValue={draft?.filters.minPriceToman}
                  />
                )}
              </FormField>
              <FormField id="landing-max" label="حداکثر قیمت (تومان)">
                {(control) => (
                  <MoneyInput
                    {...control}
                    name="maxPrice"
                    defaultValue={draft?.filters.maxPriceToman}
                  />
                )}
              </FormField>
              <fieldset className="space-y-4 rounded-lg border border-[var(--admin-color-border)] p-3 sm:col-span-2">
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
                                row.key === key ? { ...row, mode: value as AttributeMode } : row,
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
          <fieldset className="space-y-4 rounded-lg border border-[var(--admin-color-border)] p-3 sm:col-span-2">
            <legend className="px-2 text-sm font-semibold">جایگاه‌های بنر</legend>
            <p className="text-xs text-[var(--admin-color-muted)]">
              برای نمایش، گزینهٔ بنر را در پیش‌نویس اصلی کمپین هم فعال کنید. زمان‌های خالی از بازهٔ
              کمپین خوانده می‌شوند.
            </p>
            {slots.map((slot) => {
              const saved = draft?.placements.find((item) => item.slot === slot);
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
                      {slot !== 'HOME' && (
                        <FormField
                          id={`target-${slot}`}
                          label="اسلاگ مقصد"
                          hint="برای همهٔ صفحات این نوع، خالی بگذارید."
                        >
                          {(control) => (
                            <Input
                              {...control}
                              name={control.id}
                              dir="ltr"
                              defaultValue={saved?.targetSlug ?? ''}
                            />
                          )}
                        </FormField>
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
                      <FormField id={`start-${slot}`} label="آغاز شمسی تهران">
                        {(control) => (
                          <Input
                            {...control}
                            name={control.id}
                            dir="ltr"
                            placeholder="۱۴۰۵/۰۹/۰۱ ۰۹:۰۰"
                            defaultValue={
                              saved?.startsTehran ? toPersianDigits(saved.startsTehran) : ''
                            }
                            maxLength={16}
                          />
                        )}
                      </FormField>
                      <FormField id={`end-${slot}`} label="پایان شمسی تهران">
                        {(control) => (
                          <Input
                            {...control}
                            name={control.id}
                            dir="ltr"
                            placeholder="۱۴۰۵/۰۹/۰۷ ۲۳:۰۰"
                            defaultValue={
                              saved?.endsTehran ? toPersianDigits(saved.endsTehran) : ''
                            }
                            maxLength={16}
                          />
                        )}
                      </FormField>
                    </div>
                  )}
                </div>
              );
            })}
          </fieldset>
        </fieldset>
        {error && <Alert tone="danger">{error}</Alert>}
        {countLabel && <Alert tone={count ? 'success' : 'warning'}>{countLabel}</Alert>}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" loading={busy === 'save'} disabled={busy === 'preview'}>
            ذخیرهٔ صفحه و مجموعه
          </Button>
          <Button
            variant="outline"
            loading={busy === 'preview'}
            disabled={busy === 'save'}
            onClick={() => void submit('preview', formRef.current)}
          >
            پیش‌نمایش تعداد محصولات
          </Button>
        </div>
      </form>
    </Card>
  );
}
