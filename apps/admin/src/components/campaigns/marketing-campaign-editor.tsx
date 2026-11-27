'use client';

import type { components } from '@hamidian/contracts';
import { useRouter } from 'next/navigation';
import { useId, useRef, useState, type FormEvent } from 'react';

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
  focusCampaignField,
  type CampaignFieldError,
} from '@/lib/campaigns/campaign-form';
import {
  isCampaignId,
  marketingChannels,
  type CampaignDetail,
  type CampaignDraft,
} from '@/lib/campaigns/campaign-model';
import { useCampaignSelection } from '@/lib/campaigns/campaign-selection';
import { parseAdminWholeToman } from '@/lib/presentation/formatters';
import { CampaignDestinationPicker } from './campaign-destination-picker';

const marketingServerFields = {
  'Choose an available campaign destination.': {
    field: 'destination',
    message: 'مقصد انتخاب‌شده در فروشگاه در دسترس نیست.',
  },
  'Choose a campaign destination without a page number.': {
    field: 'destination',
    message: 'نشانی مقصد را بدون شمارهٔ صفحه وارد کنید.',
  },
  'Choose a public storefront path.': {
    field: 'destination',
    message: 'یک مسیر عمومی داخل فروشگاه انتخاب کنید.',
  },
  'The destination already contains tracking parameters.': {
    field: 'destination',
    message: 'پارامترهای ردیابی را از نشانی مقصد بردارید.',
  },
  'Choose an available festival.': {
    field: 'relatedFestivalId',
    message: 'جشنوارهٔ انتخاب‌شده دیگر قابل انتخاب نیست.',
  },
  'Choose an available sales campaign.': {
    field: 'relatedSalesCampaignId',
    message: 'پیشنهاد فروش انتخاب‌شده دیگر قابل انتخاب نیست.',
  },
} satisfies Record<string, CampaignFieldError>;

function RelatedCampaignField({
  view,
  label,
  value,
  onChange,
  error,
}: {
  view: 'festivals' | 'sales';
  label: string;
  value: string | null;
  onChange: (id: string | null) => void;
  error?: string;
}) {
  const id = useId();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<{ id: string; name: string }>();
  const list = useCampaignSelection<components['schemas']['CampaignListDto']>(
    open
      ? `/api/campaigns?${new URLSearchParams({ view, page: String(page), q: query.trim() })}`
      : null,
    250,
  );
  const options = list.data?.items.filter(({ archivedAt }) => !archivedAt) ?? [];

  return (
    <div className="space-y-2 rounded-lg border border-[var(--admin-color-border)] p-3">
      <p className="font-semibold">{label}</p>
      {error && (
        <p role="alert" className="text-xs text-[var(--admin-color-danger)]">
          {error}
        </p>
      )}
      {value && (
        <div className="flex flex-wrap items-center gap-2">
          <ButtonLink
            href={`/campaigns?id=${value}`}
            target="_blank"
            rel="noreferrer"
            size="sm"
            variant="outline"
          >
            {selected?.id === value ? selected.name : 'مشاهدهٔ مورد انتخاب‌شده'}
          </ButtonLink>
          <Button onClick={() => onChange(null)} size="sm" variant="ghost">
            حذف ارتباط
          </Button>
        </div>
      )}
      <Button
        size="sm"
        variant="outline"
        aria-expanded={open}
        aria-controls={`${id}-results`}
        onClick={() => setOpen(!open)}
      >
        {open ? 'بستن انتخابگر' : `انتخاب ${label}`}
      </Button>
      {open && (
        <div id={`${id}-results`} className="space-y-2">
          <FormField id={id} label={`جست‌وجوی ${label}`}>
            {(field) => (
              <Input
                {...field}
                value={query}
                maxLength={150}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
              />
            )}
          </FormField>
          {list.loading && (
            <p role="status" className="text-sm">
              در حال جست‌وجو…
            </p>
          )}
          {list.failed && (
            <Alert
              tone="danger"
              action={
                <Button variant="outline" onClick={list.retry}>
                  تلاش دوباره
                </Button>
              }
            >
              دریافت فهرست ممکن نشد.
            </Alert>
          )}
          {list.data && options.length === 0 && (
            <p className="text-sm">مورد قابل انتخاب در این صفحه پیدا نشد.</p>
          )}
          <ul className="space-y-1">
            {options.map((option) => (
              <li key={option.id}>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setSelected(option);
                    onChange(option.id);
                    setOpen(false);
                  }}
                >
                  {option.name}
                </Button>
              </li>
            ))}
          </ul>
          {(page > 1 || list.data?.hasMore) && (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                صفحهٔ قبل
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!list.data?.hasMore || page >= 10000}
                onClick={() => setPage(page + 1)}
              >
                صفحهٔ بعد
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function MarketingCampaignEditor({
  campaign,
  listPath,
}: {
  campaign?: CampaignDetail;
  listPath: string;
}) {
  const router = useRouter();
  const id = useId();
  const slug = useRef<string>(null);
  const initialPath = campaign?.marketing?.destinationPath ?? '/products';
  const [destination, setDestination] = useState(initialPath);
  const [festival, setFestival] = useState(campaign?.marketing?.relatedFestivalId ?? null);
  const [sales, setSales] = useState(campaign?.marketing?.relatedSalesCampaignId ?? null);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<CampaignFieldError | null>(null);
  const [pending, setPending] = useState(false);
  const errorFor = (field: string) =>
    fieldError?.field === field ? fieldError.message : undefined;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const element = event.currentTarget;
    const form = new FormData(element);
    setError(null);
    setFieldError(null);
    function invalid(issue: CampaignFieldError) {
      setFieldError(issue);
      focusCampaignField(element, issue.field);
    }
    const read = (field: string) => String(form.get(field) ?? '').trim();
    const startsTehran = read('startsTehran');
    const endsTehran = read('endsTehran');
    const budgetToman = parseAdminWholeToman(read('budgetToman'));
    const dateError = campaignDateError(startsTehran, endsTehran);
    if (dateError) return invalid(dateError);
    if (budgetToman === null || budgetToman > campaignIntMax)
      return invalid({
        field: 'budgetToman',
        message: 'بودجه را به تومان و به‌صورت عدد صحیح بین ۰ و ۲٬۱۴۷٬۴۸۳٬۶۴۷ وارد کنید.',
      });
    if (!destination.trim())
      return invalid({ field: 'destination', message: 'مقصد کمپین را انتخاب کنید.' });
    for (const [field, message] of Object.entries({
      name: 'نام کمپین را وارد کنید.',
      goal: 'هدف تجاری را وارد کنید.',
      message: 'توضیحات کمپین را وارد کنید.',
      channel: 'کانال کمپین را انتخاب کنید.',
    }))
      if (!read(field)) return invalid({ field, message });
    const draft: Omit<CampaignDraft, 'slug'> = {
      name: read('name'),
      goal: read('goal'),
      message: read('message'),
      channel: read('channel'),
      startsTehran,
      endsTehran,
      budgetToman,
      allProducts: true,
      productSlugs: [],
      categorySlugs: [],
      bannerEnabled: false,
      bannerPriority: 0,
      marketing: {
        destinationPath: destination.trim(),
        relatedFestivalId: festival,
        relatedSalesCampaignId: sales,
      },
    };
    if (!campaign) slug.current ??= `marketing-${crypto.randomUUID()}`;
    const body = campaign
      ? { ...draft, expectedRevision: campaign.revision }
      : { ...draft, slug: slug.current, kind: 'MARKETING' };

    setPending(true);
    try {
      const response = await fetch(campaign ? `/api/campaigns/${campaign.id}` : '/api/campaigns', {
        method: campaign ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const issue = await campaignFormError(response, marketingServerFields);
        if (typeof issue === 'string') setError(issue);
        else invalid(issue);
        return;
      }
      const result = (await response.json()) as { id?: string };
      if (!result.id || !isCampaignId(result.id)) throw new Error('Invalid campaign response.');
      router.replace(`${listPath}&id=${result.id}&step=review`);
      router.refresh();
    } catch {
      setError('ذخیرهٔ کمپین بازاریابی ممکن نشد. دوباره تلاش کنید.');
    } finally {
      setPending(false);
    }
  }

  return (
    <Card title={campaign ? 'ویرایش کمپین بازاریابی' : 'کمپین بازاریابی جدید'}>
      <form onSubmit={(event) => void save(event)} className="space-y-4" noValidate>
        {error && <Alert tone="danger">{error}</Alert>}
        <fieldset disabled={pending} className="grid min-w-0 gap-4 sm:grid-cols-2">
          <FormField id={`${id}-name`} label="نام کمپین" error={errorFor('name')} required>
            {(field) => (
              <Input
                {...field}
                name="name"
                maxLength={150}
                defaultValue={campaign?.name}
                required
              />
            )}
          </FormField>
          <FormField
            id={`${id}-channel`}
            label="کانال بازاریابی"
            hint="کانال در لینک ردیابی این کمپین استفاده می‌شود."
            error={errorFor('channel')}
            required
          >
            {(field) => (
              <Select
                {...field}
                name="channel"
                defaultValue={campaign?.channel ?? 'instagram'}
                required
                options={[
                  ...marketingChannels,
                  ...(campaign && !marketingChannels.some(({ value }) => value === campaign.channel)
                    ? [{ value: campaign.channel, label: campaign.channel }]
                    : []),
                ]}
              />
            )}
          </FormField>
          <FormField
            id={`${id}-goal`}
            label="هدف تجاری"
            hint="مثلاً معرفی محصولات جدید به بازدیدکنندگان اینستاگرام."
            error={errorFor('goal')}
            required
          >
            {(field) => (
              <Textarea
                {...field}
                name="goal"
                maxLength={500}
                defaultValue={campaign?.goal}
                required
              />
            )}
          </FormField>
          <FormField
            id={`${id}-message`}
            label="توضیحات"
            hint="یادداشت داخلی برای تیم بازاریابی."
            error={errorFor('message')}
            required
          >
            {(field) => (
              <Textarea
                {...field}
                name="message"
                maxLength={500}
                defaultValue={campaign?.message}
                required
              />
            )}
          </FormField>
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
          <FormField
            id={`${id}-budget`}
            label="بودجهٔ برنامه‌ریزی‌شدهٔ تبلیغات (تومان)"
            hint="برای فعالیت بدون بودجهٔ تبلیغات، صفر وارد کنید."
            error={errorFor('budgetToman')}
            required
          >
            {(field) => (
              <MoneyInput
                {...field}
                name="budgetToman"
                wholeToman
                defaultValue={campaign?.budgetToman ?? 0}
                required
              />
            )}
          </FormField>
          <div className="sm:col-span-2" data-campaign-field="destination" tabIndex={-1}>
            <CampaignDestinationPicker
              required
              value={destination}
              disabled={pending}
              onChange={setDestination}
              error={errorFor('destination')}
            />
          </div>
          <div data-campaign-field="relatedFestivalId" tabIndex={-1}>
            <RelatedCampaignField
              view="festivals"
              label="جشنوارهٔ مرتبط"
              value={festival}
              onChange={setFestival}
              error={errorFor('relatedFestivalId')}
            />
          </div>
          <div data-campaign-field="relatedSalesCampaignId" tabIndex={-1}>
            <RelatedCampaignField
              view="sales"
              label="پیشنهاد یا کمپین فروش مرتبط"
              value={sales}
              onChange={setSales}
              error={errorFor('relatedSalesCampaignId')}
            />
          </div>
        </fieldset>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" loading={pending}>
            ذخیرهٔ پیش‌نویس
          </Button>
          <ButtonLink variant="ghost" href={campaign ? `${listPath}&id=${campaign.id}` : listPath}>
            انصراف
          </ButtonLink>
        </div>
      </form>
    </Card>
  );
}
