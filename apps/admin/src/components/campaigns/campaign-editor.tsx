'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';

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
import { addCampaignSelection, useCampaignTaxonomy } from '@/lib/campaigns/campaign-selection';
import { festivalStepHref, suggestedFestivalSlug } from '@/lib/campaigns/festival-wizard';
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
import { CampaignTaxonomyPicker } from './campaign-taxonomy-picker';

export function CampaignEditor({
  campaign,
  createKind = 'FESTIVAL',
  view = 'all',
  canWrite = true,
}: {
  campaign?: CampaignDetail;
  createKind?: 'FESTIVAL' | 'MARKETING';
  view?: 'all' | 'basics' | 'products' | 'promotion' | 'placements';
  canWrite?: boolean;
}) {
  const router = useRouter();
  const [classifyFestival, setClassifyFestival] = useState(false);
  const [media, setMedia] = useState(campaign?.media ?? null);
  const [name, setName] = useState(campaign?.name ?? '');
  const [message, setMessage] = useState(campaign?.message ?? '');
  const [ctaLabel, setCtaLabel] = useState(campaign?.ctaLabel ?? '');
  const [allProducts, setAllProducts] = useState(campaign?.allProducts ?? true);
  const [productSlugs, setProductSlugs] = useState(campaign?.productSlugs ?? []);
  const [categorySlugs, setCategorySlugs] = useState(campaign?.categorySlugs ?? []);
  const taxonomy = useCampaignTaxonomy(view === 'all' || view === 'products');
  const [bannerEnabled, setBannerEnabled] = useState(campaign?.bannerEnabled ?? false);
  const [preview, setPreview] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const slugSuffix = useRef<string>(null);
  const isFestival = classifyFestival || (campaign?.kind ?? createKind) === 'FESTIVAL';
  const basics = view === 'all' || view === 'basics';
  const products = view === 'all' || view === 'products';
  const promotion = view === 'all' || view === 'promotion';
  const placements = view === 'all' || view === 'placements';
  const disabled = !canWrite || pending;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite || pending || uploading) return;
    const fields = new FormData(event.currentTarget);
    const value = (field: string) => String(fields.get(field) ?? '').trim();
    const startsTehran = basics ? value('startsTehran') : (campaign?.startsTehran ?? '');
    const endsTehran = basics ? value('endsTehran') : (campaign?.endsTehran ?? '');
    if (!startsTehran || !endsTehran || startsTehran >= endsTehran) {
      setError('زمان شروع و پایان را انتخاب کنید. زمان پایان باید پس از شروع باشد.');
      const field = startsTehran ? 'endsTehran' : 'startsTehran';
      event.currentTarget
        .querySelector<HTMLButtonElement>(`[data-calendar-field="${field}"]`)
        ?.focus();
      return;
    }
    const budgetToman = promotion
      ? parseAdminMoneyInput(value('budgetToman'))
      : (campaign?.budgetToman ?? 0);
    const plannedCost = value('plannedChannelCostToman');
    const plannedChannelCostToman = parseAdminMoneyInput(plannedCost);
    const priority = placements
      ? toAsciiDigits(value('bannerPriority'))
      : String(campaign?.bannerPriority ?? 0);
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
    if (!allProducts && productSlugs.length + categorySlugs.length === 0) {
      setError('محصول یا دسته‌ای انتخاب کنید یا گزینهٔ همهٔ محصولات را فعال کنید.');
      return;
    }
    if (!name.trim()) {
      setError('نام جشنواره یا کمپین را وارد کنید.');
      return;
    }
    const draft: Omit<CampaignDraft, 'kind' | 'slug' | 'trackingId' | 'trackingLabel'> = {
      name,
      message: !campaign && isFestival && !placements ? name.trim() : message,
      allProducts,
      bannerEnabled,
      budgetToman,
      ...(isFestival ? {} : { plannedChannelCostToman, channel: value('channel') }),
      audience: promotion
        ? (value('audience') as CampaignDraft['audience'])
        : (campaign?.audience ?? 'ALL_CUSTOMERS'),
      bannerPriority,
      goal: basics ? value('goal') : (campaign?.goal ?? ''),
      startsTehran,
      endsTehran,
      productSlugs: allProducts ? [] : productSlugs,
      categorySlugs: allProducts ? [] : categorySlugs,
      mediaId: media?.id ?? null,
      ctaLabel: ctaLabel.trim() || null,
      ctaPath: placements ? value('ctaPath') || null : (campaign?.ctaPath ?? null),
    };
    let slug = value('slug');
    if (!campaign && isFestival && !slug) {
      slugSuffix.current ??= crypto.randomUUID().slice(0, 8);
      slug = suggestedFestivalSlug(name, slugSuffix.current);
    }
    const body = campaign
      ? {
          ...draft,
          expectedRevision: campaign.revision,
          ...(classifyFestival ? { kind: 'FESTIVAL' as const } : {}),
        }
      : {
          ...draft,
          kind: createKind,
          slug,
          ...(isFestival
            ? {}
            : { trackingId: value('trackingId'), trackingLabel: value('trackingLabel') }),
        };
    setPending(true);
    setError(null);
    setSaved(false);
    try {
      const response = await fetch(campaign ? `/api/campaigns/${campaign.id}` : '/api/campaigns', {
        method: campaign ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        setError(await campaignError(response));
        return;
      }
      const result = (await response.json()) as { id?: string };
      if (!result.id || !isCampaignId(result.id)) throw new Error('Invalid campaign response.');
      if (!campaign && isFestival) {
        router.replace(festivalStepHref(result.id, 'products'));
      } else if (view === 'all') {
        router.replace(`/campaigns?id=${result.id}&step=${campaign ? 'review' : 'links'}`);
      } else {
        setSaved(true);
      }
      router.refresh();
    } catch {
      setError('ذخیرهٔ کمپین ممکن نشد. دوباره تلاش کنید.');
    } finally {
      setPending(false);
    }
  }

  return (
    <Card
      title={
        view === 'products'
          ? 'محدودهٔ محصولات جشنواره'
          : view === 'promotion'
            ? 'بودجه و مخاطب تخفیف'
            : view === 'placements'
              ? 'تنظیمات نمایش در فروشگاه'
              : campaign
                ? view === 'all'
                  ? 'ویرایش پیش‌نویس'
                  : 'اطلاعات و زمان‌بندی'
                : isFestival
                  ? 'جشنوارهٔ فروش جدید'
                  : 'کمپین بازاریابی جدید'
      }
    >
      <form onSubmit={(event) => void save(event)} className="space-y-5">
        <fieldset disabled={disabled} className="grid min-w-0 gap-4 sm:grid-cols-2">
          {basics && (
            <>
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
              <FormField
                id="campaign-name"
                label={isFestival ? 'نام جشنواره' : 'نام کمپین'}
                required
              >
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
                  label={isFestival ? 'بخش پایانی نشانی جشنواره' : 'اسلاگ'}
                  hint={
                    isFestival
                      ? 'در صورت خالی بودن، نشانی خودکار ساخته می‌شود.'
                      : 'حروف کوچک لاتین، عدد و خط تیره'
                  }
                  required={!isFestival}
                >
                  {(control) => (
                    <Input
                      {...control}
                      name="slug"
                      dir="ltr"
                      pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                      maxLength={64}
                      required={!isFestival}
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
                    {(control) => (
                      <Input {...control} name="trackingLabel" maxLength={96} required />
                    )}
                  </FormField>
                </>
              )}
            </>
          )}
          {promotion && (
            <>
              <FormField
                id="campaign-budget"
                label="سقف کل بودجه (تومان)"
                hint={
                  view === 'promotion'
                    ? 'برای ذخیرهٔ قانون تخفیف، بودجه‌ای بیشتر از صفر تعیین کنید.'
                    : undefined
                }
                required
              >
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
            </>
          )}
          {basics && (
            <>
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

              <fieldset className="grid min-w-0 gap-4 rounded-lg border border-[var(--admin-color-border)] p-3 sm:col-span-2 sm:grid-cols-2">
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
            </>
          )}
          {products && (
            <fieldset className="grid min-w-0 gap-4 rounded-lg border border-[var(--admin-color-border)] p-3 sm:col-span-2 sm:grid-cols-2">
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
                <div className="space-y-4 sm:col-span-2">
                  <CampaignProductSearch
                    selected={productSlugs}
                    taxonomy={taxonomy.data}
                    campaignId={campaign?.id}
                    onSelect={(slug) =>
                      setProductSlugs((current) => addCampaignSelection(current, slug, 50))
                    }
                    onRemove={(slug) =>
                      setProductSlugs((current) => current.filter((item) => item !== slug))
                    }
                    disabled={disabled}
                  />
                  {taxonomy.loading && (
                    <p role="status" className="text-sm">
                      در حال دریافت دسته‌بندی‌ها…
                    </p>
                  )}
                  {taxonomy.failed && (
                    <Alert tone="danger">
                      دریافت دسته‌بندی‌ها ممکن نشد.{' '}
                      <Button size="sm" variant="outline" onClick={taxonomy.retry}>
                        تلاش دوباره
                      </Button>
                    </Alert>
                  )}
                  <CampaignTaxonomyPicker
                    taxonomy={taxonomy.data ?? { categories: [], brands: [] }}
                    kind="categories"
                    selected={categorySlugs}
                    onChange={setCategorySlugs}
                    max={50}
                    disabled={disabled}
                    categoryMode="direct"
                  />
                </div>
              )}
            </fieldset>
          )}
          {placements && (
            <fieldset className="grid min-w-0 gap-4 rounded-lg border border-[var(--admin-color-border)] p-3 sm:col-span-2 sm:grid-cols-2">
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
              <FormField
                id="campaign-message"
                label="پیام کمپین"
                className="sm:col-span-2"
                required
              >
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
                  disabled={disabled}
                  onPendingChange={setUploading}
                  onUploaded={setMedia}
                  onClear={() => setMedia(null)}
                />
              </div>
            </fieldset>
          )}
        </fieldset>

        {error && <Alert tone="danger">{error}</Alert>}
        <div className="flex flex-wrap gap-2">
          {canWrite && (
            <Button type="submit" loading={pending} disabled={uploading}>
              {!campaign && isFestival ? 'ذخیره و انتخاب محصولات' : 'ذخیرهٔ پیش‌نویس'}
            </Button>
          )}
          {placements && (
            <Button
              variant="outline"
              aria-expanded={preview}
              aria-controls="campaign-preview"
              onClick={() => setPreview(!preview)}
            >
              {preview ? 'بستن پیش‌نمایش' : 'پیش‌نمایش بنر'}
            </Button>
          )}
          {(view === 'all' || !campaign) && (
            <ButtonLink
              href={campaign ? `/campaigns?id=${campaign.id}` : '/campaigns'}
              variant="ghost"
            >
              انصراف
            </ButtonLink>
          )}
        </div>
        {saved && (
          <p role="status" className="text-sm">
            پیش‌نویس ذخیره شد.
          </p>
        )}
        {placements && (
          <div id="campaign-preview" hidden={!preview}>
            <CampaignPreview name={name} message={message} ctaLabel={ctaLabel} media={media} />
          </div>
        )}
      </form>
    </Card>
  );
}
