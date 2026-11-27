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
import { campaignFormError } from '@/lib/campaigns/campaign-api-errors';
import {
  campaignDateError,
  campaignIntMax,
  findCampaignField,
  focusCampaignField,
  type CampaignFieldError,
} from '@/lib/campaigns/campaign-form';
import { addCampaignSelection, useCampaignTaxonomy } from '@/lib/campaigns/campaign-selection';
import { festivalStepHref, suggestedFestivalSlug } from '@/lib/campaigns/festival-wizard';
import {
  campaignAudienceOptions,
  isCampaignId,
  type CampaignDetail,
  type CampaignDraft,
} from '@/lib/campaigns/campaign-model';
import {
  parseAdminWholeToman,
  toAsciiDigits,
  toPersianDigits,
} from '@/lib/presentation/formatters';

import { CampaignPreview } from './campaign-preview';
import { CampaignDestinationPicker } from './campaign-destination-picker';
import { CampaignProductSearch } from './campaign-product-search';
import { CampaignTaxonomyPicker } from './campaign-taxonomy-picker';

const draftServerFields = {
  'Enter a valid campaign channel.': {
    field: 'channel',
    message: 'نام کانال را با حروف لاتین و عدد وارد کنید.',
  },
  'The planned channel cost exceeds the campaign budget.': {
    field: 'plannedChannelCostToman',
    message: 'هزینهٔ کانال باید کمتر یا برابر بودجهٔ کل باشد.',
  },
  'Supply both the banner link and its label.': {
    field: 'ctaPath',
    message: 'برای دکمهٔ بنر، متن و مسیر مقصد را با هم وارد کنید.',
  },
  'Choose a public storefront path.': {
    field: 'ctaPath',
    message: 'یک مسیر عمومی فروشگاه مانند ‎/products‎ وارد کنید.',
  },
} satisfies Record<string, CampaignFieldError>;

export function CampaignEditor({
  campaign,
  createKind = 'FESTIVAL',
  view = 'all',
  canWrite = true,
  listQuery,
}: {
  campaign?: CampaignDetail;
  createKind?: 'FESTIVAL' | 'MARKETING' | 'SALES';
  view?: 'all' | 'basics' | 'products' | 'promotion' | 'placements';
  canWrite?: boolean;
  listQuery?: Record<string, string>;
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
  const [fieldError, setFieldError] = useState<CampaignFieldError | null>(null);
  const [saved, setSaved] = useState(false);
  const slugSuffix = useRef<string>(null);
  const isSalesOffer = campaign ? campaign.managementPurpose === 'SALES' : createKind === 'SALES';
  const isFestival = classifyFestival || (campaign?.kind ?? createKind) === 'FESTIVAL';
  const basics = view === 'all' || view === 'basics';
  const products = view === 'all' || view === 'products';
  const promotion = view === 'all' || view === 'promotion';
  const placements = !isSalesOffer && (view === 'all' || view === 'placements');
  const disabled = !canWrite || pending;
  const salesListPath = `/campaigns?${new URLSearchParams({ ...listQuery, view: 'sales' })}`;
  const salesDetailPath = (id: string, step?: string) =>
    `${salesListPath}&id=${id}${step ? `&step=${step}` : ''}`;
  const errorFor = (field: string) =>
    fieldError?.field === field ? fieldError.message : undefined;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite || pending || uploading) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    setError(null);
    setFieldError(null);
    setSaved(false);
    function invalid(issue: CampaignFieldError) {
      setFieldError(issue);
      focusCampaignField(form, issue.field);
    }
    const value = (field: string) => String(fields.get(field) ?? '').trim();
    const startsTehran = basics ? value('startsTehran') : (campaign?.startsTehran ?? '');
    const endsTehran = basics ? value('endsTehran') : (campaign?.endsTehran ?? '');
    const dateError = campaignDateError(startsTehran, endsTehran);
    if (dateError) return invalid(dateError);
    const budgetToman = promotion
      ? parseAdminWholeToman(value('budgetToman'))
      : (campaign?.budgetToman ?? 0);
    const plannedCost = value('plannedChannelCostToman');
    const plannedChannelCostToman = parseAdminWholeToman(plannedCost);
    const priority = placements
      ? toAsciiDigits(value('bannerPriority'))
      : String(campaign?.bannerPriority ?? 0);
    const bannerPriority = /^\d{1,3}$/.test(priority) ? Number(priority) : -1;
    if (budgetToman === null || budgetToman > campaignIntMax)
      return invalid({
        field: 'budgetToman',
        message: 'بودجه را به تومان و به‌صورت عدد صحیح بین ۰ و ۲٬۱۴۷٬۴۸۳٬۶۴۷ وارد کنید.',
      });
    if (plannedCost && (plannedChannelCostToman === null || plannedChannelCostToman > budgetToman))
      return invalid(draftServerFields['The planned channel cost exceeds the campaign budget.']);
    if (bannerPriority < 0 || bannerPriority > 100)
      return invalid({
        field: 'bannerPriority',
        message: 'اولویت نمایش باید عدد صحیح بین ۰ و ۱۰۰ باشد.',
      });
    if (!allProducts && productSlugs.length + categorySlugs.length === 0) {
      setError('محصول یا دسته‌ای انتخاب کنید یا گزینهٔ همهٔ محصولات را فعال کنید.');
      return;
    }
    if (!name.trim())
      return invalid({ field: 'name', message: 'نام جشنواره یا کمپین را وارد کنید.' });
    if (basics && !value('goal'))
      return invalid({ field: 'goal', message: 'هدف کمپین را وارد کنید.' });
    if (
      !isFestival &&
      !isSalesOffer &&
      !/^[a-z0-9][a-z0-9._-]*$/i.test(value('channel').normalize('NFKC').replace(/ +/g, '-'))
    )
      return invalid(draftServerFields['Enter a valid campaign channel.']);
    if (placements && !message.trim())
      return invalid({ field: 'message', message: 'پیام کمپین را وارد کنید.' });
    if (placements && Boolean(value('ctaPath')) !== Boolean(ctaLabel.trim()))
      return invalid(draftServerFields['Supply both the banner link and its label.']);
    const draft: Omit<CampaignDraft, 'kind' | 'slug' | 'trackingId' | 'trackingLabel'> = {
      name,
      message: isSalesOffer || (!campaign && isFestival && !placements) ? name.trim() : message,
      allProducts,
      bannerEnabled,
      budgetToman,
      ...(isFestival || isSalesOffer ? {} : { plannedChannelCostToman, channel: value('channel') }),
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
    if (!campaign && slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
      return invalid({
        field: 'slug',
        message: 'بخش پایانی نشانی را با حروف کوچک لاتین، عدد و خط تیره وارد کنید.',
      });
    if (!campaign && !isSalesOffer && !slug) {
      slugSuffix.current ??= crypto.randomUUID().slice(0, 8);
      slug = isFestival
        ? suggestedFestivalSlug(name, slugSuffix.current)
        : `campaign-${slugSuffix.current}`;
    }
    if (!campaign && isSalesOffer) {
      slugSuffix.current ??= crypto.randomUUID();
      slug = `offer-${slugSuffix.current}`;
    }
    const body = campaign
      ? {
          ...draft,
          expectedRevision: campaign.revision,
          ...(classifyFestival ? { kind: 'FESTIVAL' as const } : {}),
        }
      : {
          ...draft,
          slug,
          ...(createKind === 'SALES'
            ? { managementPurpose: 'SALES' as const }
            : {
                kind: createKind,
                ...(isFestival
                  ? {}
                  : {
                      trackingId: value('trackingId') || slug,
                      trackingLabel: value('trackingLabel') || slug,
                    }),
              }),
        };
    setPending(true);
    try {
      const response = await fetch(campaign ? `/api/campaigns/${campaign.id}` : '/api/campaigns', {
        method: campaign ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const issue = await campaignFormError(response, draftServerFields);
        if (typeof issue === 'string') setError(issue);
        else if (!findCampaignField(form, issue.field)) setError(issue.message);
        else invalid(issue);
        return;
      }
      const result = (await response.json()) as { id?: string };
      if (!result.id || !isCampaignId(result.id)) throw new Error('Invalid campaign response.');
      if (!campaign && isFestival) {
        router.replace(festivalStepHref(result.id, 'products'));
      } else if (isSalesOffer) {
        router.replace(salesDetailPath(result.id, campaign ? 'review' : 'promotion'));
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
        isSalesOffer
          ? campaign
            ? 'ویرایش پیشنهاد فروش'
            : 'پیشنهاد فروش جدید'
          : view === 'products'
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
      <form onSubmit={(event) => void save(event)} className="space-y-5" noValidate>
        <fieldset disabled={disabled} className="grid min-w-0 gap-4 sm:grid-cols-2">
          {basics && (
            <>
              {campaign?.kind === 'LEGACY' && !isSalesOffer && (
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
                label={isSalesOffer ? 'نام پیشنهاد' : isFestival ? 'نام جشنواره' : 'نام کمپین'}
                error={errorFor('name')}
                required
              >
                {(control) => (
                  <Input
                    {...control}
                    name="name"
                    value={name}
                    onChange={(event) => setName(event.currentTarget.value)}
                    maxLength={150}
                    required
                  />
                )}
              </FormField>
              {!isFestival && !isSalesOffer && (
                <FormField
                  id="campaign-channel"
                  label="کانال"
                  hint="برای نمونه instagram"
                  error={errorFor('channel')}
                  required
                >
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
              {!campaign && !isSalesOffer && (
                <details className="space-y-3 rounded-lg border border-[var(--admin-color-border)] p-3 sm:col-span-2">
                  <summary className="cursor-pointer text-sm font-semibold">
                    تنظیمات پیشرفته
                  </summary>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <FormField
                      id="campaign-slug"
                      label="بخش پایانی نشانی"
                      hint={
                        isFestival
                          ? 'در صورت خالی بودن، نشانی خودکار ساخته می‌شود.'
                          : 'اگر خالی باشد، شناسهٔ نشانی خودکار ساخته می‌شود.'
                      }
                      error={errorFor('slug')}
                    >
                      {(control) => <Input {...control} name="slug" dir="ltr" maxLength={64} />}
                    </FormField>
                    {!isFestival && (
                      <>
                        <FormField
                          id="campaign-tracking-id"
                          label="شناسهٔ ردیابی"
                          hint="اگر خالی باشد، از شناسهٔ نشانی استفاده می‌شود."
                        >
                          {(control) => (
                            <Input {...control} name="trackingId" dir="ltr" maxLength={64} />
                          )}
                        </FormField>
                        <FormField
                          id="campaign-tracking-label"
                          label="نام ردیابی"
                          hint="اگر خالی باشد، از شناسهٔ نشانی استفاده می‌شود."
                        >
                          {(control) => <Input {...control} name="trackingLabel" maxLength={96} />}
                        </FormField>
                      </>
                    )}
                  </div>
                </details>
              )}
            </>
          )}
          {promotion && (
            <>
              <FormField
                id="campaign-budget"
                label={isSalesOffer ? 'سقف بودجهٔ تخفیف (تومان)' : 'سقف کل بودجه (تومان)'}
                hint={
                  view === 'promotion' || isSalesOffer
                    ? 'صفر برای پیش‌نویس مجاز است. ثبت قانون تخفیف به بودجهٔ مثبت نیاز دارد.'
                    : 'صفر یعنی بودجه‌ای برای تخفیف در نظر نگرفته‌اید.'
                }
                error={errorFor('budgetToman')}
                required
              >
                {(control) => (
                  <MoneyInput
                    {...control}
                    name="budgetToman"
                    wholeToman
                    defaultValue={campaign?.budgetToman ?? 0}
                    required
                  />
                )}
              </FormField>
              {!isFestival && !isSalesOffer && (
                <FormField
                  id="campaign-channel-cost"
                  label="هزینهٔ برنامه‌ریزی‌شدهٔ کانال (تومان)"
                  hint="این مبلغ از بودجهٔ کل برای هزینهٔ کانال کنار گذاشته می‌شود. صفر یعنی بودجهٔ کانال صفر است. مقدار خالی یعنی هنوز تعیین نشده است."
                  error={errorFor('plannedChannelCostToman')}
                >
                  {(control) => (
                    <MoneyInput
                      {...control}
                      name="plannedChannelCostToman"
                      wholeToman
                      defaultValue={campaign?.plannedChannelCostToman ?? ''}
                    />
                  )}
                </FormField>
              )}
              <FormField
                id="campaign-audience"
                label="گروه مخاطب تخفیف"
                hint="شرط داشتن خرید پرداخت‌شده بر اساس سابقهٔ سفارش مشتری بررسی می‌شود."
              >
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
              <FormField
                id="campaign-goal"
                label="هدف"
                hint="مثلاً افزایش فروش انگشترهای نقره در پایان هفته."
                error={errorFor('goal')}
                className="sm:col-span-2"
                required
              >
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
                  error={errorFor('startsTehran')}
                  defaultValue={campaign?.startsTehran}
                  required
                />
                <DualCalendarPicker
                  label="زمان پایان"
                  name="endsTehran"
                  error={errorFor('endsTehran')}
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
                hint="از ۰ تا ۱۰۰. در جایگاه‌های هم‌زمان، عدد بزرگ‌تر اولویت بیشتری دارد."
                error={errorFor('bannerPriority')}
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
                error={errorFor('message')}
                className="sm:col-span-2"
                required
              >
                {(control) => (
                  <Textarea
                    {...control}
                    name="message"
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
              <CampaignDestinationPicker
                name="ctaPath"
                label="مقصد دکمهٔ بنر"
                defaultValue={campaign?.ctaPath ?? ''}
                hint="اگر دکمه لازم نیست، مقصد و متن دکمه را خالی بگذارید."
                error={errorFor('ctaPath')}
                disabled={disabled}
              />
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
              href={
                isSalesOffer
                  ? campaign
                    ? salesDetailPath(campaign.id, 'review')
                    : salesListPath
                  : campaign
                    ? `/campaigns?id=${campaign.id}`
                    : '/campaigns'
              }
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
