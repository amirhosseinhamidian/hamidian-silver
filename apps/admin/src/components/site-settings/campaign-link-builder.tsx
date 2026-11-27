'use client';

import type { components } from '@hamidian/contracts';
import { useId, useState, type FormEvent } from 'react';
import { CampaignDestinationPicker } from '@/components/campaigns/campaign-destination-picker';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/form-control';
import { FormField } from '@/components/ui/form-field';
import { campaignFormError } from '@/lib/campaigns/campaign-api-errors';
import {
  findCampaignField,
  focusCampaignField,
  type CampaignFieldError,
} from '@/lib/campaigns/campaign-form';

type CreateLink = components['schemas']['CreateCampaignLinkDto'];
type CreatedLink = {
  url: string;
  campaignId: string;
  campaign: string;
  source: string;
  medium: string;
  content: string | null;
};
const destinationErrors = {
  'Choose a public storefront path.': {
    field: 'destination',
    message: 'یک مسیر عمومی داخل فروشگاه انتخاب کنید.',
  },
  'Choose an available campaign destination.': {
    field: 'destination',
    message: 'مقصد انتخاب‌شده اکنون در فروشگاه در دسترس نیست.',
  },
  'Choose a supported campaign destination page.': {
    field: 'destination',
    message: 'شمارهٔ صفحه باید عدد صحیح بین ۱ و ۱٬۰۰۰ باشد.',
  },
  'The destination already contains tracking parameters.': {
    field: 'destination',
    message: 'پارامترهای UTM را از نشانی مقصد بردارید.',
  },
  'The destination contains an unsupported or repeated parameter.': {
    field: 'destination',
    message: 'نشانی مقصد پارامتر تکراری یا نامعتبر دارد.',
  },
} satisfies Record<string, CampaignFieldError>;

function readCreatedLink(
  result: Partial<components['schemas']['CampaignLinkDto']> | null,
): CreatedLink {
  if (!result?.url || !result.campaignId || !result.campaign)
    throw new Error('Campaign link missing');
  const url = new URL(result.url);
  const source = url.searchParams.get('utm_source');
  const medium = url.searchParams.get('utm_medium');
  if (!['https:', 'http:'].includes(url.protocol) || !source || !medium)
    throw new Error('Invalid campaign link');
  return {
    url: url.href,
    campaignId: result.campaignId,
    campaign: result.campaign,
    source,
    medium,
    content: url.searchParams.get('utm_content'),
  };
}

const fields = [
  {
    name: 'destination',
    label: 'مسیر مقصد',
    example: '/products?page=2',
    maxLength: 1000,
    required: true,
  },
  {
    name: 'campaignId',
    label: 'شناسهٔ ثابت کمپین',
    example: 'nowruz-1406',
    maxLength: 64,
    required: true,
  },
  {
    name: 'campaign',
    label: 'نام کمپین در UTM',
    example: 'nowruz-sale',
    maxLength: 96,
    required: true,
  },
  { name: 'source', label: 'منبع', example: 'newsletter', maxLength: 96, required: true },
  { name: 'medium', label: 'کانال', example: 'email', maxLength: 96, required: true },
  { name: 'content', label: 'محتوا', example: 'hero-banner', maxLength: 96, required: false },
] as const satisfies readonly {
  name: keyof CreateLink;
  label: string;
  example: string;
  maxLength: number;
  required: boolean;
}[];

export function CampaignLinkBuilder({
  campaign,
  fixedDestination = false,
  campaignName,
  campaignStatus,
  canReadReports = false,
}: {
  campaign?: Pick<CreateLink, 'campaignId' | 'campaign' | 'destination' | 'medium'>;
  fixedDestination?: boolean;
  campaignName?: string;
  campaignStatus?: string;
  canReadReports?: boolean;
} = {}) {
  const formId = useId();
  const [pending, setPending] = useState(false);
  const [link, setLink] = useState<CreatedLink | null>(null);
  const [error, setError] = useState('');
  const [fieldError, setFieldError] = useState<CampaignFieldError | null>(null);
  const [copyStatus, setCopyStatus] = useState('');
  const errorFor = (field: string) =>
    fieldError?.field === field ? fieldError.message : undefined;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setLink(null);
    setError('');
    setFieldError(null);
    setCopyStatus('');
    const element = event.currentTarget;
    const form = new FormData(element);
    function invalid(issue: CampaignFieldError) {
      if (!findCampaignField(element, issue.field)) {
        setError(issue.message);
        return;
      }
      setFieldError(issue);
      focusCampaignField(element, issue.field);
    }
    const text = (name: keyof CreateLink) => String(form.get(name) ?? '').trim();
    const content = text('content');
    const input: CreateLink = {
      destination: text('destination'),
      campaignId: text('campaignId'),
      campaign: text('campaign'),
      source: text('source'),
      medium: text('medium'),
      ...(content ? { content } : {}),
    };
    if (!input.destination.startsWith('/') || input.destination.startsWith('//')) {
      return invalid(destinationErrors['Choose a public storefront path.']);
    }
    const normalized = (value: string) =>
      value.normalize('NFKC').trim().toLowerCase().replace(/ +/g, '-');
    for (const { name, label, required } of fields) {
      if (name === 'destination') continue;
      const value = normalized(input[name] ?? '');
      if ((!value && !required) || /^[a-z0-9][a-z0-9._-]*$/.test(value)) continue;
      return invalid({ field: name, message: `برای «${label}» مقدار لاتین معتبر وارد کنید.` });
    }
    if (normalized(input.source) === 'direct')
      return invalid({
        field: 'source',
        message: 'برای ترافیک مستقیم از خود نشانی مقصد استفاده کنید.',
      });
    if (['direct', 'none'].includes(normalized(input.medium)))
      return invalid({
        field: 'medium',
        message: 'برای کانال مستقیم از خود نشانی مقصد استفاده کنید.',
      });
    setPending(true);
    try {
      const response = await fetch('/api/site-settings/campaign-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!response.ok) {
        const issue = await campaignFormError(response, destinationErrors);
        if (typeof issue === 'string') setError(issue);
        else invalid(issue);
        return;
      }
      const result = (await response.json()) as Partial<
        components['schemas']['CampaignLinkDto']
      > | null;
      setLink(readCreatedLink(result));
    } catch {
      setError('ساخت لینک کمپین انجام نشد.');
    } finally {
      setPending(false);
    }
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.url);
      setCopyStatus('لینک کپی شد.');
    } catch {
      setCopyStatus('لینک را از فیلد انتخاب و کپی کنید.');
    }
  }

  return (
    <Card title="ساخت لینک کمپین" className="mt-8">
      <form onSubmit={(event) => void submit(event)} className="space-y-4" noValidate>
        {error ? <Alert tone="danger">{error}</Alert> : null}
        {campaignName && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <strong>{campaignName}</strong>
            {campaignStatus && <Badge tone="neutral">وضعیت کمپین {campaignStatus}</Badge>}
          </div>
        )}
        <div className="grid gap-4 md:grid-cols-2">
          {fields.map(({ name, label, example, maxLength, required }) =>
            campaign && (name === 'campaignId' || name === 'campaign') ? (
              <input key={name} type="hidden" name={name} value={campaign[name]} />
            ) : name === 'destination' && !(campaign && fixedDestination) ? (
              <CampaignDestinationPicker
                key={name}
                name={name}
                label="مقصد لینک"
                disabled={pending}
                defaultValue={campaign?.destination}
                error={errorFor(name)}
                required
              />
            ) : (
              <FormField
                key={name}
                id={`${formId}-${name}`}
                label={label}
                error={errorFor(name)}
                required={required}
              >
                {(props) => (
                  <Input
                    {...props}
                    name={name}
                    dir="ltr"
                    placeholder={example}
                    defaultValue={
                      name === 'source' && campaign?.medium === 'instagram'
                        ? 'instagram'
                        : name === 'destination' || name === 'medium'
                          ? campaign?.[name]
                          : undefined
                    }
                    readOnly={Boolean(
                      campaign && fixedDestination && (name === 'destination' || name === 'medium'),
                    )}
                    maxLength={maxLength}
                    required={required}
                  />
                )}
              </FormField>
            ),
          )}
        </div>
        <Button type="submit" loading={pending}>
          ساخت لینک
        </Button>
        {link ? (
          <div className="space-y-3">
            <div role="status">
              <Badge tone="success">لینک آمادهٔ کپی است</Badge>
            </div>
            <FormField id={`${formId}-result`} label="لینک کمپین">
              {(props) => <Input {...props} dir="ltr" value={link.url} readOnly />}
            </FormField>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt>کمپین</dt>
                <dd>
                  <bdi>{link.campaign}</bdi>
                </dd>
              </div>
              <div>
                <dt>شناسهٔ ردیابی</dt>
                <dd>
                  <bdi>{link.campaignId}</bdi>
                </dd>
              </div>
              <div>
                <dt>منبع و کانال</dt>
                <dd>
                  <bdi>
                    {link.source} / {link.medium}
                  </bdi>
                </dd>
              </div>
              {link.content && (
                <div>
                  <dt>محتوا</dt>
                  <dd>
                    <bdi>{link.content}</bdi>
                  </dd>
                </div>
              )}
            </dl>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => void copy()}>
                کپی لینک
              </Button>
              {canReadReports && (
                <ButtonLink
                  variant="outline"
                  href={`/growth?${new URLSearchParams({ campaignId: link.campaignId, source: link.source, medium: link.medium })}`}
                >
                  گزارش منبع و کانال
                </ButtonLink>
              )}
            </div>
          </div>
        ) : null}
        {copyStatus ? <p role="status">{copyStatus}</p> : null}
      </form>
    </Card>
  );
}
