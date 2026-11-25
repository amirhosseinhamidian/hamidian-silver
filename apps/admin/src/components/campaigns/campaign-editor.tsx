'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { SiteMediaField } from '@/components/site-settings/site-media-field';
import { Alert } from '@/components/ui/alert';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DualCalendarPicker } from '@/components/ui/dual-calendar-picker';
import { Input, Textarea } from '@/components/ui/form-control';
import { FormField } from '@/components/ui/form-field';
import { MoneyInput } from '@/components/ui/money-input';
import { Select } from '@/components/ui/select';
import { campaignError } from '@/lib/campaigns/campaign-api-errors';
import {
  campaignAudienceOptions,
  isCampaignId,
  type CampaignDetail,
  type CampaignDraft,
} from '@/lib/campaigns/campaign-model';
import {
  parseAdminMoneyInput,
  toAsciiDigits,
  toPersianDigits,
} from '@/lib/presentation/formatters';

import { CampaignPreview } from './campaign-preview';
import { CampaignProductSearch } from './campaign-product-search';

function parseSlugs(value: string) {
  return value
    .split(/[\n,،]/)
    .map((slug) => slug.trim())
    .filter(Boolean);
}

export function CampaignEditor({
  campaign,
  createKind = 'FESTIVAL',
}: {
  campaign?: CampaignDetail;
  createKind?: 'FESTIVAL' | 'MARKETING';
}) {
  const router = useRouter();
  const [classifyFestival, setClassifyFestival] = useState(false);
  const [media, setMedia] = useState(campaign?.media ?? null);
  const [name, setName] = useState(campaign?.name ?? '');
  const [message, setMessage] = useState(campaign?.message ?? '');
  const [ctaLabel, setCtaLabel] = useState(campaign?.ctaLabel ?? '');
  const [allProducts, setAllProducts] = useState(campaign?.allProducts ?? true);
  const [productSlugs, setProductSlugs] = useState(campaign?.productSlugs.join('\n') ?? '');
  const [bannerEnabled, setBannerEnabled] = useState(campaign?.bannerEnabled ?? false);
  const [preview, setPreview] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isFestival = classifyFestival || (campaign?.kind ?? createKind) === 'FESTIVAL';

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || uploading) return;
    const fields = new FormData(event.currentTarget);
    const value = (field: string) => String(fields.get(field) ?? '').trim();
    const startsTehran = value('startsTehran');
    const endsTehran = value('endsTehran');
    if (!startsTehran || !endsTehran || startsTehran >= endsTehran) {
      setError('زمان شروع و پایان را انتخاب کنید. زمان پایان باید پس از شروع باشد.');
      const field = startsTehran ? 'endsTehran' : 'startsTehran';
      event.currentTarget
        .querySelector<HTMLButtonElement>(`[data-calendar-field="${field}"]`)
        ?.focus();
      return;
    }
    const budgetToman = parseAdminMoneyInput(value('budgetToman'));
    const plannedCost = value('plannedChannelCostToman');
    const plannedChannelCostToman = parseAdminMoneyInput(plannedCost);
    const priority = toAsciiDigits(value('bannerPriority'));
    const bannerPriority = /^\d{1,3}$/.test(priority) ? Number(priority) : -1;
    if (
      budgetToman === null ||
      budgetToman > 2_147_483_647 ||
      (plannedCost !== '' &&
        (plannedChannelCostToman === null || plannedChannelCostToman > budgetToman)) ||
      bannerPriority < 0 ||
      bannerPriority > 100
    ) {
      setError('بودجه، سهم هزینهٔ کانال یا اولویت نمایش را بررسی کنید.');
      return;
    }
    const draft: Omit<CampaignDraft, 'kind' | 'slug' | 'trackingId' | 'trackingLabel'> = {
      name,
      message,
      allProducts,
      bannerEnabled,
      budgetToman,
      ...(isFestival ? {} : { plannedChannelCostToman, channel: value('channel') }),
      audience: value('audience') as CampaignDraft['audience'],
      bannerPriority,
      goal: value('goal'),
      startsTehran,
      endsTehran,
      productSlugs: allProducts ? [] : parseSlugs(productSlugs),
      categorySlugs: allProducts ? [] : parseSlugs(value('categorySlugs')),
      mediaId: media?.id ?? null,
      ctaLabel: ctaLabel.trim() || null,
      ctaPath: value('ctaPath') || null,
    };
    const body = campaign
      ? {
          ...draft,
          expectedRevision: campaign.revision,
          ...(classifyFestival ? { kind: 'FESTIVAL' as const } : {}),
        }
      : {
          ...draft,
          kind: createKind,
          slug: value('slug'),
          ...(isFestival
            ? {}
            : { trackingId: value('trackingId'), trackingLabel: value('trackingLabel') }),
        };
    setPending(true);
    setError(null);
    try {
      const response = await fetch(campaign ? `/api/campaigns/${campaign.id}` : '/api/campaigns', {
        method: campaign ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        setError(await campaignError(response));
        setPending(false);
        return;
      }
      const result = (await response.json()) as { id?: string };
      if (!result.id || !isCampaignId(result.id)) throw new Error('Invalid campaign response.');
      const step = campaign ? 'review' : isFestival ? 'landing' : 'links';
      router.replace(`/campaigns?id=${result.id}&step=${step}`);
      router.refresh();
    } catch {
      setError('ذخیرهٔ کمپین ممکن نشد. دوباره تلاش کنید.');
      setPending(false);
    }
  }

  return (
    <Card
      title={
        campaign ? 'ویرایش پیش‌نویس' : isFestival ? 'جشنوارهٔ فروش جدید' : 'کمپین بازاریابی جدید'
      }
    >
      <form onSubmit={(event) => void save(event)} className="space-y-5">
        <fieldset disabled={pending} className="grid gap-4 sm:grid-cols-2">
          {campaign?.kind === 'LEGACY' && (
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                checked={classifyFestival}
                onChange={(event) => setClassifyFestival(event.currentTarget.checked)}
              />
              ثبت این پیش‌نویس به‌عنوان جشنوارهٔ فروش
            </label>
          )}
          <FormField id="campaign-name" label={isFestival ? 'نام جشنواره' : 'نام کمپین'} required>
            {(control) => (
              <Input
                {...control}
                value={name}
                onChange={(event) => setName(event.currentTarget.value)}
                maxLength={150}
                required
              />
            )}
          </FormField>
          {!isFestival && (
            <FormField id="campaign-channel" label="کانال" hint="برای نمونه instagram" required>
              {(control) => (
                <Input
                  {...control}
                  name="channel"
                  defaultValue={campaign?.channel}
                  maxLength={96}
                  required
                />
              )}
            </FormField>
          )}
          {!campaign && (
            <FormField
              id="campaign-slug"
              label="اسلاگ"
              hint="حروف کوچک لاتین، عدد و خط تیره"
              required
            >
              {(control) => (
                <Input
                  {...control}
                  name="slug"
                  dir="ltr"
                  pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                  maxLength={64}
                  required
                />
              )}
            </FormField>
          )}
          {!campaign && !isFestival && (
            <>
              <FormField
                id="campaign-tracking-id"
                label="شناسهٔ ردیابی"
                hint="مقدار utm_id در لینک‌های کمپین"
                required
              >
                {(control) => (
                  <Input {...control} name="trackingId" dir="ltr" maxLength={64} required />
                )}
              </FormField>
              <FormField
                id="campaign-tracking-label"
                label="نام ردیابی"
                hint="مقدار utm_campaign در لینک‌های کمپین"
                required
              >
                {(control) => <Input {...control} name="trackingLabel" maxLength={96} required />}
              </FormField>
            </>
          )}
          <FormField id="campaign-budget" label="سقف کل بودجه (تومان)" required>
            {(control) => (
              <MoneyInput
                {...control}
                name="budgetToman"
                defaultValue={campaign?.budgetToman ?? 0}
                required
              />
            )}
          </FormField>
          {!isFestival && (
            <FormField
              id="campaign-channel-cost"
              label="هزینهٔ برنامه‌ریزی‌شدهٔ کانال (تومان)"
              hint="این مبلغ از سقف بودجهٔ تخفیف کم می‌شود. اگر هنوز مشخص نیست، خالی بگذارید."
            >
              {(control) => (
                <MoneyInput
                  {...control}
                  name="plannedChannelCostToman"
                  defaultValue={campaign?.plannedChannelCostToman ?? ''}
                />
              )}
            </FormField>
          )}
          <FormField id="campaign-audience" label="گروه مخاطب تخفیف">
            {(control) => (
              <Select
                {...control}
                name="audience"
                options={campaignAudienceOptions}
                defaultValue={campaign?.audience ?? 'ALL_CUSTOMERS'}
              />
            )}
          </FormField>
          <FormField id="campaign-goal" label="هدف" className="sm:col-span-2" required>
            {(control) => (
              <Textarea
                {...control}
                name="goal"
                defaultValue={campaign?.goal}
                maxLength={500}
                required
              />
            )}
          </FormField>

          <fieldset className="grid gap-4 rounded-lg border border-[var(--admin-color-border)] p-3 sm:col-span-2 sm:grid-cols-2">
            <legend className="px-2 text-sm font-semibold">زمان‌بندی به وقت تهران</legend>
            <DualCalendarPicker
              label="زمان آغاز"
              name="startsTehran"
              defaultValue={campaign?.startsTehran}
              required
            />
            <DualCalendarPicker
              label="زمان پایان"
              name="endsTehran"
              defaultValue={campaign?.endsTehran}
              required
            />
          </fieldset>

          <fieldset className="grid gap-4 rounded-lg border border-[var(--admin-color-border)] p-3 sm:col-span-2 sm:grid-cols-2">
            <legend className="px-2 text-sm font-semibold">محدودهٔ محصول</legend>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                checked={allProducts}
                onChange={(event) => setAllProducts(event.currentTarget.checked)}
              />
              همهٔ محصولات
            </label>
            {!allProducts && (
              <div className="sm:col-span-2">
                <CampaignProductSearch
                  selected={parseSlugs(productSlugs)}
                  onSelect={(slug) =>
                    setProductSlugs([...parseSlugs(productSlugs), slug].join('\n'))
                  }
                  disabled={pending || parseSlugs(productSlugs).length >= 50}
                />
              </div>
            )}
            <FormField
              id="campaign-products"
              label="اسلاگ محصولات"
              hint="اسلاگ‌ها را در خط‌های جدا یا با ویرگول وارد کنید."
            >
              {(control) => (
                <Textarea
                  {...control}
                  name="productSlugs"
                  dir="ltr"
                  disabled={allProducts}
                  value={productSlugs}
                  onChange={(event) => setProductSlugs(event.currentTarget.value)}
                />
              )}
            </FormField>
            <FormField id="campaign-categories" label="اسلاگ دسته‌ها">
              {(control) => (
                <Textarea
                  {...control}
                  name="categorySlugs"
                  dir="ltr"
                  disabled={allProducts}
                  defaultValue={campaign?.categorySlugs.join('\n')}
                />
              )}
            </FormField>
          </fieldset>

          <fieldset className="grid gap-4 rounded-lg border border-[var(--admin-color-border)] p-3 sm:col-span-2 sm:grid-cols-2">
            <legend className="px-2 text-sm font-semibold">تنظیمات نمایش کمپین</legend>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={bannerEnabled}
                onChange={(event) => setBannerEnabled(event.currentTarget.checked)}
              />
              فعال‌سازی جایگاه‌های انتخاب‌شده در بازهٔ کمپین
            </label>
            <FormField
              id="campaign-priority"
              label="اولویت نمایش"
              hint="از ۰ تا ۱۰۰. مقدار پیشنهادی هنگام تنظیم هر جایگاه."
            >
              {(control) => (
                <Input
                  {...control}
                  name="bannerPriority"
                  inputMode="numeric"
                  defaultValue={toPersianDigits(campaign?.bannerPriority ?? 0)}
                  maxLength={3}
                  required
                />
              )}
            </FormField>
            <FormField id="campaign-message" label="پیام کمپین" className="sm:col-span-2" required>
              {(control) => (
                <Textarea
                  {...control}
                  value={message}
                  onChange={(event) => setMessage(event.currentTarget.value)}
                  maxLength={500}
                  required
                />
              )}
            </FormField>
            <FormField id="campaign-cta-label" label="متن دکمه">
              {(control) => (
                <Input
                  {...control}
                  value={ctaLabel}
                  onChange={(event) => setCtaLabel(event.currentTarget.value)}
                  maxLength={80}
                />
              )}
            </FormField>
            <FormField
              id="campaign-cta-path"
              label="مسیر مقصد"
              hint="برای نمونه /categories/silver-rings"
            >
              {(control) => (
                <Input
                  {...control}
                  name="ctaPath"
                  dir="ltr"
                  defaultValue={campaign?.ctaPath ?? ''}
                  maxLength={1000}
                />
              )}
            </FormField>
            <div className="sm:col-span-2">
              <SiteMediaField
                label="بنر کمپین"
                altText={name.slice(0, 150)}
                media={media}
                disabled={pending}
                onPendingChange={setUploading}
                onUploaded={setMedia}
                onClear={() => setMedia(null)}
              />
            </div>
          </fieldset>
        </fieldset>

        {error && <Alert tone="danger">{error}</Alert>}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" loading={pending} disabled={uploading}>
            ذخیرهٔ پیش‌نویس
          </Button>
          <Button
            variant="outline"
            aria-expanded={preview}
            aria-controls="campaign-preview"
            onClick={() => setPreview(!preview)}
          >
            {preview ? 'بستن پیش‌نمایش' : 'پیش‌نمایش بنر'}
          </Button>
          <ButtonLink
            href={campaign ? `/campaigns?id=${campaign.id}` : '/campaigns'}
            variant="ghost"
          >
            انصراف
          </ButtonLink>
        </div>
        <div id="campaign-preview" hidden={!preview}>
          <CampaignPreview name={name} message={message} ctaLabel={ctaLabel} media={media} />
        </div>
      </form>
    </Card>
  );
}
