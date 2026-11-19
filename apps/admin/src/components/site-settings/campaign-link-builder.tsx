'use client';

import type { components } from '@hamidian/contracts';
import { useId, useState, type FormEvent } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/form-control';
import { FormField } from '@/components/ui/form-field';

type CreateLink = components['schemas']['CreateCampaignLinkDto'];
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

export function CampaignLinkBuilder() {
  const formId = useId();
  const [pending, setPending] = useState(false);
  const [link, setLink] = useState('');
  const [error, setError] = useState('');
  const [copyStatus, setCopyStatus] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setLink('');
    setError('');
    setCopyStatus('');
    const form = new FormData(event.currentTarget);
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
    try {
      const response = await fetch('/api/site-settings/campaign-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (response.status === 409) {
        setError('پارامترهای UTM مقصد یا ترکیب نام و شناسهٔ کمپین با یک ثبت قبلی تعارض دارد.');
        return;
      }
      if (response.status === 400) {
        setError('مسیر عمومی مقصد و نام‌های کوتاه انگلیسی را بررسی کنید.');
        return;
      }
      if (!response.ok) throw new Error('Campaign link request failed');
      const result = (await response.json()) as Partial<
        components['schemas']['CampaignLinkDto']
      > | null;
      if (typeof result?.url !== 'string' || !result.url) throw new Error('Campaign link missing');
      setLink(result.url);
    } catch {
      setError('ساخت لینک کمپین انجام نشد.');
    } finally {
      setPending(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopyStatus('لینک کپی شد.');
    } catch {
      setCopyStatus('لینک را از فیلد انتخاب و کپی کنید.');
    }
  }

  return (
    <Card title="ساخت لینک کمپین" className="mt-8">
      <form onSubmit={(event) => void submit(event)} className="space-y-4">
        {error ? <Alert tone="danger">{error}</Alert> : null}
        <div className="grid gap-4 md:grid-cols-2">
          {fields.map(({ name, label, example, maxLength, required }) => (
            <FormField key={name} id={`${formId}-${name}`} label={label} required={required}>
              {(props) => (
                <Input
                  {...props}
                  name={name}
                  dir="ltr"
                  placeholder={example}
                  maxLength={maxLength}
                  required={required}
                />
              )}
            </FormField>
          ))}
        </div>
        <Button type="submit" loading={pending}>
          ساخت لینک
        </Button>
        {link ? (
          <div className="space-y-3">
            <FormField id={`${formId}-result`} label="لینک کمپین">
              {(props) => <Input {...props} dir="ltr" value={link} readOnly />}
            </FormField>
            <Button type="button" variant="outline" onClick={() => void copy()}>
              کپی لینک
            </Button>
          </div>
        ) : null}
        {copyStatus ? <p role="status">{copyStatus}</p> : null}
      </form>
    </Card>
  );
}
