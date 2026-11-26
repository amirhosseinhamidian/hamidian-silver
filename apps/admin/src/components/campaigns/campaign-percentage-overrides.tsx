'use client';

import type { components } from '@hamidian/contracts';
import { useId, useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form-control';
import { FormField } from '@/components/ui/form-field';
import { Select } from '@/components/ui/select';
import type { CampaignTaxonomy } from '@/lib/campaigns/campaign-selection';
import { CampaignProductSearch } from './campaign-product-search';

type Preview = components['schemas']['CampaignProductPricePreviewDto'];
type Rate = components['schemas']['PromotionPercentageOverrideDto'];
type Target = components['schemas']['PromotionRateTargetDto'];
type RateDraft = Target & { percentage: string };

export function formatRateDrafts(rates: readonly Rate[], targets: readonly Target[]): RateDraft[] {
  return rates.map(({ productId, variantId = null, rateBps }) => {
    const target = targets.find(
      (row) => row.productId === productId && row.variantId === variantId,
    );
    return {
      productId,
      variantId,
      productName: target?.productName ?? productId,
      variantLabel: target?.variantLabel ?? variantId,
      percentage: String(rateBps / 100),
    };
  });
}

export function CampaignPercentageOverrides({
  campaignId,
  taxonomy,
  rates,
  onChange,
  disabled,
}: {
  campaignId: string;
  taxonomy?: CampaignTaxonomy;
  rates: RateDraft[];
  onChange: (rates: RateDraft[]) => void;
  disabled: boolean;
}) {
  const id = useId();
  const [preview, setPreview] = useState<(Preview & { productId: string }) | null>(null);
  const [target, setTarget] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  async function selectProduct(slug: string) {
    setLoading(true);
    setError(false);
    setPreview(null);
    setTarget('');
    try {
      const query = new URLSearchParams({ slug });
      const response = await fetch(`/api/promotions/${campaignId}/product-preview?${query}`);
      if (!response.ok) throw new Error('Could not load the festival rate targets.');
      const product = (await response.json()) as Preview;
      if (!product.productId) throw new Error('The product identifier is missing.');
      setPreview({ ...product, productId: product.productId });
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  const available = preview
    ? preview.prices.filter(
        (price) =>
          price.active &&
          !rates.some(
            (row) => row.productId === preview.productId && row.variantId === price.variantId,
          ),
      )
    : [];
  const choice = available.find((row) => (row.variantId ?? 'default') === target);

  return (
    <section className="space-y-3 sm:col-span-2" aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`} className="font-semibold">
        درصد اختصاصی محصول و واریانت
      </h3>
      <p className="text-sm text-[var(--admin-color-muted)]">
        نرخ محصول روی قیمت پیش‌فرض و واریانت‌های بدون نرخ اختصاصی اعمال می‌شود. با حذف نرخ اختصاصی،
        نرخ محصول یا نرخ پیش‌فرض جشنواره اعمال می‌شود.
      </p>
      <CampaignProductSearch
        campaignId={campaignId}
        withinCampaign
        taxonomy={taxonomy}
        disabled={disabled || loading || rates.length >= 500}
        onSelect={(slug) => void selectProduct(slug)}
      />
      {loading && (
        <p role="status" className="text-sm">
          در حال دریافت واریانت‌ها…
        </p>
      )}
      {error && <Alert tone="danger">دریافت واریانت‌های محصول ممکن نشد.</Alert>}
      {rates.length >= 500 && <Alert tone="info">سقف ۵۰۰ نرخ اختصاصی تکمیل شده است.</Alert>}
      {preview && (
        <div className="flex flex-wrap items-end gap-2">
          {available.length ? (
            <>
              <FormField id={`${id}-target`} label={`انتخاب قیمت برای ${preview.name}`}>
                {(control) => (
                  <Select
                    {...control}
                    value={target}
                    disabled={disabled || rates.length >= 500}
                    onValueChange={setTarget}
                    placeholder="انتخاب محصول یا واریانت"
                    options={available.map(({ variantId, label }) => ({
                      value: variantId ?? 'default',
                      label: variantId ? label : 'محصول و واریانت‌های بدون نرخ اختصاصی',
                    }))}
                  />
                )}
              </FormField>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={disabled || !choice || rates.length >= 500}
                onClick={() => {
                  if (!choice) return;
                  onChange([
                    ...rates,
                    {
                      productId: preview.productId,
                      productName: preview.name,
                      variantId: choice.variantId,
                      variantLabel: choice.variantId ? choice.label : null,
                      percentage: '',
                    },
                  ]);
                  setTarget('');
                }}
              >
                افزودن نرخ اختصاصی
              </Button>
            </>
          ) : (
            <p className="text-sm">برای {preview.name} گزینهٔ فعال دیگری در دسترس نیست.</p>
          )}
        </div>
      )}
      {rates.length > 0 && (
        <ul className="space-y-2">
          {rates.map((rate) => {
            const label = `${rate.productName} · ${rate.variantLabel ?? 'محصول'}`;
            const rowId = `${id}-${rate.productId}-${rate.variantId ?? 'default'}`;
            return (
              <li key={rowId} className="flex flex-wrap items-end gap-2">
                <FormField id={rowId} label={`درصد تخفیف ${label}`} required>
                  {(control) => (
                    <Input
                      {...control}
                      inputMode="decimal"
                      maxLength={5}
                      required
                      disabled={disabled}
                      value={rate.percentage}
                      onChange={(event) =>
                        onChange(
                          rates.map((row) =>
                            row === rate ? { ...row, percentage: event.target.value } : row,
                          ),
                        )
                      }
                    />
                  )}
                </FormField>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  aria-label={`حذف نرخ ${label}`}
                  disabled={disabled}
                  onClick={() => onChange(rates.filter((row) => row !== rate))}
                >
                  حذف نرخ
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
