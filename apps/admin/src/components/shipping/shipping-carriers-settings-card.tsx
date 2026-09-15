'use client';

import { useState, type FormEvent } from 'react';
import { SiteMediaField } from '@/components/site-settings/site-media-field';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/form-control';
import { FormField } from '@/components/ui/form-field';
import {
  parseAdminShippingCarrier,
  type AdminShippingCarrier,
} from '@/lib/shipping/shipping-pricing-model';
import type { SiteMedia } from '@/lib/site-settings/site-settings-model';

type Props = Readonly<{
  initialCarriers: readonly AdminShippingCarrier[];
  canWrite: boolean;
}>;

function responseMessage(payload: unknown): string {
  if (typeof payload === 'object' && payload !== null && 'message' in payload) {
    const message = (payload as { message?: unknown }).message;
    if (typeof message === 'string') return message;
    if (Array.isArray(message)) return message.join('، ');
  }
  return 'ذخیره شرکت ارسال انجام نشد. دوباره تلاش کنید.';
}

function validTrackingUrl(value: string): boolean {
  return !value.trim() || value.trim().startsWith('https://');
}

function CarrierEditor({
  carrier,
  canWrite,
  onUpdated,
  onError,
  onSuccess,
}: Readonly<{
  carrier: AdminShippingCarrier;
  canWrite: boolean;
  onUpdated: (carrier: AdminShippingCarrier) => void;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
}>) {
  const [name, setName] = useState(carrier.name);
  const [trackingUrl, setTrackingUrl] = useState(carrier.trackingUrl ?? '');
  const [logo, setLogo] = useState<SiteMedia | null>(carrier.logo);
  const [pending, setPending] = useState(false);

  async function update(values: Record<string, unknown>, success: string) {
    if (pending || !canWrite) return;
    setPending(true);
    onError('');
    try {
      const response = await fetch(`/api/shipping/carriers/${encodeURIComponent(carrier.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const payload = (await response.json().catch(() => null)) as unknown;
      if (!response.ok) throw new Error(responseMessage(payload));
      const updated = parseAdminShippingCarrier(payload);
      if (!updated) throw new Error('پاسخ سرویس شرکت‌های ارسال معتبر نبود.');
      setName(updated.name);
      setTrackingUrl(updated.trackingUrl ?? '');
      setLogo(updated.logo);
      onUpdated(updated);
      onSuccess(success);
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : responseMessage(null));
    } finally {
      setPending(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (name.trim().length < 2) return onError('نام شرکت ارسال باید حداقل ۲ نویسه باشد.');
    if (!validTrackingUrl(trackingUrl))
      return onError('نشانی سایت استعلام باید با https:// آغاز شود.');
    void update(
      {
        name: name.trim(),
        trackingUrl: trackingUrl.trim() || null,
        logoMediaId: logo?.id ?? null,
      },
      `اطلاعات «${name.trim()}» ذخیره شد.`,
    );
  }

  return (
    <Card>
      <form className="space-y-4" onSubmit={submit}>
        <div className="flex items-center justify-between gap-3">
          <Badge tone={carrier.isActive ? 'success' : 'neutral'}>
            {carrier.isActive ? 'فعال' : 'غیرفعال'}
          </Badge>
          <Button
            type="button"
            size="sm"
            variant="outline"
            loading={pending}
            disabled={!canWrite}
            onClick={() =>
              void update(
                { isActive: !carrier.isActive },
                carrier.isActive
                  ? `«${carrier.name}» از گزینه‌های ساخت مرسوله حذف شد.`
                  : `«${carrier.name}» به گزینه‌های ساخت مرسوله اضافه شد.`,
              )
            }
          >
            {carrier.isActive ? 'غیرفعال‌کردن' : 'فعال‌کردن'}
          </Button>
        </div>
        <FormField id={`carrier-name-${carrier.id}`} label="نام شرکت ارسال" required>
          {(props) => (
            <Input
              {...props}
              value={name}
              maxLength={200}
              disabled={!canWrite || pending}
              onChange={(event) => setName(event.target.value)}
            />
          )}
        </FormField>
        <FormField
          id={`carrier-url-${carrier.id}`}
          label="نشانی سایت استعلام"
          hint="نشانی کامل و امن را با https:// وارد کنید."
        >
          {(props) => (
            <Input
              {...props}
              type="url"
              dir="ltr"
              value={trackingUrl}
              maxLength={1000}
              disabled={!canWrite || pending}
              onChange={(event) => setTrackingUrl(event.target.value)}
            />
          )}
        </FormField>
        <SiteMediaField
          label="نماد شرکت ارسال"
          media={logo}
          altText={name.trim() || 'نماد شرکت ارسال'}
          aspect="wide"
          disabled={!canWrite || pending}
          hint="ترجیحاً تصویر PNG یا WebP با پس‌زمینه شفاف بارگذاری کنید."
          onUploaded={setLogo}
          onClear={() => setLogo(null)}
        />
        <Button type="submit" loading={pending} disabled={!canWrite || name.trim().length < 2}>
          ذخیره شرکت
        </Button>
      </form>
    </Card>
  );
}

export function ShippingCarriersSettingsCard({ initialCarriers, canWrite }: Props) {
  const [carriers, setCarriers] = useState(initialCarriers);
  const [name, setName] = useState('');
  const [trackingUrl, setTrackingUrl] = useState('');
  const [logo, setLogo] = useState<SiteMedia | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !canWrite) return;
    if (name.trim().length < 2) return setError('نام شرکت ارسال باید حداقل ۲ نویسه باشد.');
    if (!validTrackingUrl(trackingUrl))
      return setError('نشانی سایت استعلام باید با https:// آغاز شود.');
    setPending(true);
    setError('');
    setSuccess('');
    try {
      const response = await fetch('/api/shipping/carriers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          trackingUrl: trackingUrl.trim() || null,
          logoMediaId: logo?.id ?? null,
          isActive: true,
        }),
      });
      const payload = (await response.json().catch(() => null)) as unknown;
      if (!response.ok) throw new Error(responseMessage(payload));
      const created = parseAdminShippingCarrier(payload);
      if (!created) throw new Error('پاسخ سرویس شرکت‌های ارسال معتبر نبود.');
      setCarriers((current) => [created, ...current]);
      setName('');
      setTrackingUrl('');
      setLogo(null);
      setSuccess(`شرکت «${created.name}» اضافه و برای ساخت مرسوله فعال شد.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : responseMessage(null));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="space-y-4" aria-labelledby="shipping-carriers-heading">
      <div>
        <h2 id="shipping-carriers-heading" className="text-xl font-black">
          شرکت‌های ارسال
        </h2>
        <p className="mt-2 text-sm leading-7 text-[var(--admin-color-muted)]">
          شرکت‌های فعال هنگام ساخت مرسوله دستی در دسترس هستند. نام، نماد و نشانی استعلام شرکت
          انتخاب‌شده روی همان مرسوله ذخیره می‌شود.
        </p>
      </div>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {success ? <Alert tone="success">{success}</Alert> : null}
      {canWrite ? (
        <Card title="افزودن شرکت ارسال" description="اطلاعات شرکت جدید را ثبت کنید.">
          <form className="grid gap-4 lg:grid-cols-2" onSubmit={create}>
            <FormField id="new-carrier-name" label="نام شرکت ارسال" required>
              {(props) => (
                <Input
                  {...props}
                  value={name}
                  maxLength={200}
                  placeholder="مثلاً ماهکس"
                  disabled={pending}
                  onChange={(event) => setName(event.target.value)}
                />
              )}
            </FormField>
            <FormField
              id="new-carrier-url"
              label="نشانی سایت استعلام"
              hint="نشانی کامل و امن را با https:// وارد کنید."
            >
              {(props) => (
                <Input
                  {...props}
                  type="url"
                  dir="ltr"
                  value={trackingUrl}
                  maxLength={1000}
                  placeholder="https://example.com/tracking"
                  disabled={pending}
                  onChange={(event) => setTrackingUrl(event.target.value)}
                />
              )}
            </FormField>
            <SiteMediaField
              label="نماد شرکت ارسال"
              media={logo}
              altText={name.trim() || 'نماد شرکت ارسال'}
              aspect="wide"
              disabled={pending}
              hint="ترجیحاً تصویر PNG یا WebP با پس‌زمینه شفاف بارگذاری کنید."
              onUploaded={setLogo}
              onClear={() => setLogo(null)}
            />
            <div className="flex items-end">
              <Button type="submit" loading={pending} disabled={name.trim().length < 2}>
                افزودن شرکت
              </Button>
            </div>
          </form>
        </Card>
      ) : null}
      {carriers.length ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {carriers.map((carrier) => (
            <CarrierEditor
              key={carrier.id}
              carrier={carrier}
              canWrite={canWrite}
              onError={setError}
              onSuccess={setSuccess}
              onUpdated={(updated) =>
                setCarriers((current) =>
                  current.map((item) => (item.id === updated.id ? updated : item)),
                )
              }
            />
          ))}
        </div>
      ) : (
        <Alert tone="neutral">هنوز شرکت ارسالی ثبت نشده است.</Alert>
      )}
    </section>
  );
}
