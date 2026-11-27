'use client';

import type { components } from '@hamidian/contracts';
import { useId, useState, type FormEvent } from 'react';
import { CampaignProductSearch } from '@/components/campaigns/campaign-product-search';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/form-control';
import { FormField } from '@/components/ui/form-field';
import { campaignFormError } from '@/lib/campaigns/campaign-api-errors';
import {
  campaignIntMax,
  focusCampaignField,
  type CampaignFieldError,
} from '@/lib/campaigns/campaign-form';
import { useCampaignTaxonomy } from '@/lib/campaigns/campaign-selection';
import { toAsciiDigits, toPersianDigits } from '@/lib/presentation/formatters';

type Quota = components['schemas']['CampaignQuotaAdminDto'];
const quotaServerFields = {
  'The quota is below confirmed, manual, or reserved quantities.': {
    field: 'limit',
    message: 'سقف سهمیه باید همهٔ فروش‌های قطعی، دستی و رزروهای فعال را پوشش دهد.',
  },
  'The quota exceeds sellable stock.': {
    field: 'limit',
    message: 'افزایش سهمیه از موجودی قابل فروش بیشتر است.',
  },
} satisfies Record<string, CampaignFieldError>;

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
  const [fieldError, setFieldError] = useState<CampaignFieldError | null>(null);
  const [saved, setSaved] = useState(false);
  const formId = useId();
  const taxonomy = useCampaignTaxonomy();
  const endpoint = `/api/campaigns/${campaignId}/quota`;

  async function load(slug: string) {
    setBusy(true);
    setError(null);
    setFieldError(null);
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
    const form = event.currentTarget;
    const fields = new FormData(form);
    setError(null);
    setFieldError(null);
    setSaved(false);
    const integer = (field: string) => {
      const value = toAsciiDigits(String(fields.get(field) ?? '').trim());
      return /^\d+$/.test(value) ? Number(value) : NaN;
    };
    function invalid(issue: CampaignFieldError) {
      setFieldError(issue);
      focusCampaignField(form, issue.field);
    }
    const limit = integer('limit');
    const manualSold = integer('manualSold');
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > campaignIntMax)
      return invalid({
        field: 'limit',
        message: 'سقف سهمیه را به‌صورت تعداد صحیح بین ۱ و ۲٬۱۴۷٬۴۸۳٬۶۴۷ وارد کنید.',
      });
    if (!Number.isSafeInteger(manualSold) || manualSold > campaignIntMax)
      return invalid({
        field: 'manualSold',
        message: 'فروش دستی را به‌صورت تعداد صحیح بین ۰ و ۲٬۱۴۷٬۴۸۳٬۶۴۷ وارد کنید.',
      });
    setBusy(true);
    try {
      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: quota.slug,
          limit,
          manualSold,
          expectedRevision: quota.revision,
        }),
      });
      if (response.status === 409) {
        setError('سهمیه تغییر کرده یا با کمپین دیگری تداخل دارد. محصول را دوباره بارگذاری کنید.');
        return;
      }
      if (!response.ok) {
        const issue = await campaignFormError(response, quotaServerFields);
        if (typeof issue === 'string') setError(issue);
        else invalid(issue);
        return;
      }
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
              <form
                key={`${quota.slug}:${quota.revision}`}
                className="space-y-3"
                onSubmit={save}
                noValidate
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField
                    id={`${formId}-limit`}
                    label="سقف سهمیه (تعداد)"
                    hint="حداقل یک واحد. فروش دستی، خرید قطعی سایت و رزروهای فعال از همین سهمیه کم می‌شوند."
                    error={fieldError?.field === 'limit' ? fieldError.message : undefined}
                    required
                  >
                    {(props) => (
                      <Input
                        {...props}
                        name="limit"
                        inputMode="numeric"
                        defaultValue={quota.limit || undefined}
                        required
                      />
                    )}
                  </FormField>
                  <FormField
                    id={`${formId}-manual`}
                    label="تعداد کل فروش دستی"
                    hint="مجموع فروش دستی محصول در این کمپین را وارد کنید. اگر فروش دستی ندارید، صفر وارد کنید."
                    error={fieldError?.field === 'manualSold' ? fieldError.message : undefined}
                    required
                  >
                    {(props) => (
                      <Input
                        {...props}
                        name="manualSold"
                        inputMode="numeric"
                        defaultValue={quota.manualSold}
                        required
                      />
                    )}
                  </FormField>
                </div>
                <p className="text-xs text-[var(--admin-color-muted)]">
                  ثبت فروش دستی، شمار فروش و ماندهٔ سهمیهٔ کمپین را تغییر می‌دهد. اگر کالا از انبار
                  سایت خارج شده، موجودی واریانت را در بخش انبار اصلاح کنید.
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
