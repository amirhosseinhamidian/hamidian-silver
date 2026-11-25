'use client';

import type { components } from '@hamidian/contracts';
import { useId, useState, type FormEvent } from 'react';
import { CampaignProductSearch } from '@/components/campaigns/campaign-product-search';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/form-control';
import { FormField } from '@/components/ui/form-field';
import { useCampaignTaxonomy } from '@/lib/campaigns/campaign-selection';
import { toPersianDigits } from '@/lib/presentation/formatters';

type Quota = components['schemas']['CampaignQuotaAdminDto'];

export function CampaignQuotaEditor({
  campaignId,
  canWrite,
  canAdd,
}: {
  campaignId: string;
  canWrite: boolean;
  canAdd: boolean;
}) {
  const [quota, setQuota] = useState<Quota | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const formId = useId();
  const taxonomy = useCampaignTaxonomy();
  const endpoint = `/api/campaigns/${campaignId}/quota`;

  async function load(slug: string) {
    setBusy(true);
    setError(null);
    setSaved(false);
    setQuota(null);
    try {
      const response = await fetch(`${endpoint}?${new URLSearchParams({ slug })}`, {
        cache: 'no-store',
      });
      if (!response.ok) throw new Error('Could not read quota.');
      setQuota((await response.json()) as Quota);
    } catch {
      setError('دریافت سهمیهٔ محصول ممکن نشد.');
    } finally {
      setBusy(false);
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!quota || busy) return;
    const fields = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: quota.slug,
          limit: Number(fields.get('limit')),
          manualSold: Number(fields.get('manualSold')),
          expectedRevision: quota.revision,
        }),
      });
      if (response.status === 409) {
        setError('سهمیه تغییر کرده یا با کمپین دیگری تداخل دارد. محصول را دوباره بارگذاری کنید.');
        return;
      }
      if (response.status === 400) {
        setError(
          'محصول باید مشمول قانون کمپین باشد و سهمیه با موجودی و تعداد ثبت‌شده هم‌خوانی داشته باشد.',
        );
        return;
      }
      if (!response.ok) throw new Error('Could not save quota.');
      setQuota((await response.json()) as Quota);
      setSaved(true);
    } catch {
      setError('ذخیرهٔ سهمیه ممکن نشد.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="سهمیه و فروش دستی">
      <div className="space-y-4">
        <CampaignProductSearch
          campaignId={campaignId}
          taxonomy={taxonomy.data}
          disabled={busy}
          onSelect={(slug) => void load(slug)}
        />
        {busy && (
          <p role="status" className="text-sm">
            در حال دریافت یا ذخیرهٔ سهمیه…
          </p>
        )}
        {error && <Alert tone="danger">{error}</Alert>}
        {saved && (
          <p role="status" className="text-sm">
            سهمیه ذخیره شد.
          </p>
        )}
        {quota && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">{quota.name}</h3>
            <dl className="grid grid-cols-2 gap-3 text-sm lg:grid-cols-3">
              {[
                ['سقف سهمیه', quota.limit],
                ['فروش قطعی سایت', quota.siteSold],
                ['فروش دستی', quota.manualSold],
                ['رزرو فعال', quota.reserved],
                ['ماندهٔ سهمیه', quota.remaining],
                ['موجودی قابل فروش سایت', quota.sellableStock],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-[var(--admin-color-muted)]">{label}</dt>
                  <dd className="font-medium">{toPersianDigits(value)}</dd>
                </div>
              ))}
            </dl>
            {canWrite && (canAdd || quota.revision > 0) && (
              <form key={`${quota.slug}:${quota.revision}`} className="space-y-3" onSubmit={save}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField id={`${formId}-limit`} label="سقف سهمیه">
                    {(props) => (
                      <Input
                        {...props}
                        name="limit"
                        type="number"
                        min={1}
                        step={1}
                        defaultValue={quota.limit || undefined}
                        required
                      />
                    )}
                  </FormField>
                  <FormField id={`${formId}-manual`} label="تعداد کل فروش دستی">
                    {(props) => (
                      <Input
                        {...props}
                        name="manualSold"
                        type="number"
                        min={0}
                        step={1}
                        defaultValue={quota.manualSold}
                        required
                      />
                    )}
                  </FormField>
                </div>
                <p className="text-xs text-[var(--admin-color-muted)]">
                  این عدد فقط شمار فروش کمپین را تغییر می‌دهد. اگر کالا از انبار سایت خارج شده،
                  موجودی واریانت را در بخش انبار اصلاح کنید.
                </p>
                <Button type="submit" loading={busy}>
                  ذخیره سهمیه
                </Button>
              </form>
            )}
            {canWrite && !canAdd && quota.revision === 0 && (
              <p className="text-sm text-[var(--admin-color-muted)]">
                سهمیهٔ جدید باید پیش از شروع کمپین تعریف شود.
              </p>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
