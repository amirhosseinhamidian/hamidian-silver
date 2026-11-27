'use client';

import type { components } from '@hamidian/contracts';
import { useId, useState, type FormEvent } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/form-control';
import { FormField } from '@/components/ui/form-field';

type Settings = components['schemas']['CatalogMerchandisingDto'];
type Update = components['schemas']['UpdateCatalogMerchandisingDto'];

const tehranDateTime = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Tehran',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

function toTehranInput(value: string | null) {
  if (!value) return '';
  const parts = Object.fromEntries(
    tehranDateTime.formatToParts(new Date(value)).map(({ type, value }) => [type, value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
}

function fromTehranInput(value: FormDataEntryValue | null) {
  if (typeof value !== 'string' || !value) return null;
  const timestamp = value.length === 16 ? `${value}:00` : value;
  return new Date(`${timestamp}+03:30`).toISOString();
}

export function ProductMerchandisingForm({
  productId,
  settings,
  published,
}: Readonly<{ productId: string; settings: Settings | null; published: boolean }>) {
  const id = useId();
  const [revision, setRevision] = useState(settings?.revision ?? 0);
  const [enabled, setEnabled] = useState(settings?.enabled ?? false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setMessage('');
    setError('');
    try {
      const body: Update = {
        enabled,
        pinned: form.has('pinned'),
        weight: Number(form.get('weight')),
        startsAt: fromTehranInput(form.get('startsAt')),
        endsAt: fromTehranInput(form.get('endsAt')),
        expectedRevision: revision,
      };
      const response = await fetch(
        `/api/catalog/products/${encodeURIComponent(productId)}/merchandising`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      if (response.status === 409) {
        throw new Error(
          'صفحه را تازه کنید. اگر تنظیمات تغییر نکرده، سقف ۲۴ محصول فعال یا زمان‌بندی‌شده را بررسی کنید.',
        );
      }
      if (response.status === 400) {
        throw new Error('وضعیت انتشار محصول، سنجاق یا وزن و بازهٔ زمانی را بررسی کنید.');
      }
      if (!response.ok) throw new Error('ذخیرهٔ اولویت محصول انجام نشد.');
      const saved: Settings = await response.json();
      setRevision(saved.revision);
      setMessage('اولویت نمایش محصول ذخیره شد.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'ذخیرهٔ اولویت محصول انجام نشد.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      className="mt-6"
      title="اولویت نمایش محصول"
      description="این تنظیم در فهرست فروشگاه با ترتیب «اولویت فروشگاه» اعمال می‌شود."
    >
      {settings ? (
        <form onSubmit={(event) => void submit(event)} className="space-y-4">
          {error ? <Alert tone="danger">{error}</Alert> : null}
          {message ? <Alert tone="success">{message}</Alert> : null}
          {!published ? (
            <Alert tone="info">برای فعال کردن اولویت، ابتدا محصول را منتشر کنید.</Alert>
          ) : null}
          <fieldset disabled={busy} className="space-y-4">
            <Checkbox
              label="فعال‌سازی اولویت"
              checked={enabled}
              disabled={!published && !enabled}
              onChange={(event) => setEnabled(event.target.checked)}
            />
            <Checkbox
              name="pinned"
              label="سنجاق در بالای محصولات موجود"
              defaultChecked={settings.pinned}
            />
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField id={`${id}-weight`} label="وزن اولویت" hint="عدد صحیح بین ۰ تا ۱۰۰">
                {(props) => (
                  <Input
                    {...props}
                    name="weight"
                    type="number"
                    min={0}
                    max={100}
                    defaultValue={settings.weight}
                    required
                    dir="ltr"
                  />
                )}
              </FormField>
              <FormField id={`${id}-start`} label="شروع به وقت تهران">
                {(props) => (
                  <Input
                    {...props}
                    name="startsAt"
                    type="datetime-local"
                    step={1}
                    defaultValue={toTehranInput(settings.startsAt)}
                    required={enabled}
                    dir="ltr"
                  />
                )}
              </FormField>
              <FormField
                id={`${id}-end`}
                label="پایان به وقت تهران"
                hint="حداکثر ۹۰ روز پس از شروع"
              >
                {(props) => (
                  <Input
                    {...props}
                    name="endsAt"
                    type="datetime-local"
                    step={1}
                    defaultValue={toTehranInput(settings.endsAt)}
                    required={enabled}
                    dir="ltr"
                  />
                )}
              </FormField>
            </div>
            <Button type="submit" disabled={!published && enabled}>
              {busy ? 'در حال ذخیره…' : 'ذخیرهٔ اولویت نمایش'}
            </Button>
          </fieldset>
        </form>
      ) : (
        <Alert tone="warning">تنظیمات اولویت نمایش بارگیری نشد. صفحه را دوباره باز کنید.</Alert>
      )}
    </Card>
  );
}
