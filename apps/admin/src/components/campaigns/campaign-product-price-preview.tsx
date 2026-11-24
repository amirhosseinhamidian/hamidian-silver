'use client';

import type { components } from '@hamidian/contracts';
import { useState } from 'react';
import { CampaignProductSearch } from '@/components/campaigns/campaign-product-search';
import { Alert } from '@/components/ui/alert';
import { Card } from '@/components/ui/card';
import { formatAdminToman, toPersianDigits } from '@/lib/presentation/formatters';

type Preview = components['schemas']['CampaignProductPricePreviewDto'];
const reasons: Record<
  components['schemas']['CatalogCampaignOfferDto']['conditions'][number],
  string
> = {
  COUPON: 'کد تخفیف',
  CUSTOMER: 'شرایط مشتری',
  MINIMUM: 'حداقل خرید',
  ORDER_AMOUNT: 'مبلغ سفارش',
  BUNDLE: 'ترکیب بسته',
  SHIPPING: 'شرایط ارسال',
};
const cell = 'border-b border-[var(--admin-color-border)] px-3 py-2 text-start';
const money = (amount: number | null) => (amount === null ? '—' : formatAdminToman(amount));

export function CampaignProductPricePreview({ campaignId }: { campaignId: string }) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function selectProduct(slug: string) {
    setBusy(true);
    setPreview(null);
    setError(false);
    try {
      const query = new URLSearchParams({ slug });
      const response = await fetch(`/api/promotions/${campaignId}/product-preview?${query}`);
      if (!response.ok) throw new Error('Could not load campaign product prices.');
      setPreview((await response.json()) as Preview);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      title="پیش‌نمایش قیمت محصول و واریانت‌ها"
      description="قیمت هر واحد بر اساس قانون ذخیره‌شدهٔ همین کمپین محاسبه می‌شود."
    >
      <div className="space-y-4">
        <CampaignProductSearch
          selected={[]}
          disabled={busy}
          onSelect={(slug) => void selectProduct(slug)}
        />
        {busy && (
          <p role="status" className="text-sm">
            در حال محاسبهٔ قیمت‌ها…
          </p>
        )}
        {error && <Alert tone="danger">دریافت پیش‌نمایش قیمت ممکن نشد.</Alert>}
        {preview && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <caption className="mb-2 text-start font-semibold">{preview.name}</caption>
              <thead>
                <tr>
                  {['قیمت یا واریانت', 'قیمت عادی', 'تخفیف', 'قیمت نهایی'].map((label) => (
                    <th scope="col" className={cell} key={label}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.prices.map(({ variantId, label, active, regularToman, offer }) => (
                  <tr key={variantId ?? 'default'}>
                    <th scope="row" className={cell}>
                      {label}
                      {active ? '' : ' (غیرفعال)'}
                    </th>
                    <td className={cell}>{money(regularToman)}</td>
                    <td className={cell}>
                      {offer?.price
                        ? `${money(offer.price.discountToman)} (${toPersianDigits(offer.price.discountPercent)}٪)`
                        : offer?.conditions.map((condition) => reasons[condition]).join('، ') ||
                          '—'}
                    </td>
                    <td className={cell}>
                      {money(offer?.price?.finalToman ?? (offer ? null : regularToman))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Card>
  );
}
