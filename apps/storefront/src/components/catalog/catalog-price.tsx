'use client';

import type { components } from '@hamidian/contracts';
import { CampaignTag } from '@/components/catalog/campaign-tag';
import { useCampaignVisibility } from '@/lib/campaigns/campaign-visibility';
import { DiscountBadge } from '@/components/catalog/discount-badge';
import { formatTomanPrice } from '@/lib/catalog/presentation';
import { getDiscountPercent } from '@/lib/catalog/pricing';

type Offer = components['schemas']['CatalogCampaignOfferDto'];
const labels: Record<Offer['conditions'][number], string> = {
  COUPON: 'نیاز به کد تخفیف',
  CUSTOMER: 'ویژهٔ مشتریان واجد شرایط',
  MINIMUM: 'حداقل مبلغ خرید',
  ORDER_AMOUNT: 'تخفیف روی مبلغ سفارش',
  BUNDLE: 'ویژهٔ خرید بستهٔ ترکیبی',
  SHIPPING: 'ارسال رایگان با شرایط کمپین',
};

export function CatalogPrice({
  sale,
  compare,
  offer,
  extra = 0,
  priceClassName,
  details = false,
}: {
  sale: number | null;
  compare?: number | null;
  offer?: Offer | null;
  extra?: number;
  priceClassName: string;
  details?: boolean;
}) {
  const visible = useCampaignVisibility(offer?.campaignId, offer?.endsAt);
  const active = visible ? offer : null;
  const price = active?.price;
  const previous = price?.regularToman ?? (active ? null : compare);
  const percent = price?.discountPercent ?? getDiscountPercent(previous, sale);
  const final = price?.finalToman ?? sale;

  return (
    <>
      {active && (
        <div>
          <CampaignTag name={active.name} />
        </div>
      )}
      {percent !== null && (
        <div className="flex items-center justify-end gap-2 text-xs text-[var(--sf-color-muted)]">
          <del className="line-through">
            {formatTomanPrice(previous == null ? null : previous + (price ? extra : 0))}
          </del>
          <DiscountBadge percent={percent} />
        </div>
      )}
      <p
        className={
          percent !== null ? `${priceClassName} sf-catalog-price__reduced` : priceClassName
        }
      >
        {formatTomanPrice(final === null ? null : final + extra)}
      </p>
      {details && price && (
        <p className="text-xs text-[var(--sf-color-muted)]">
          تخفیف هر واحد {formatTomanPrice(price.discountToman)}
        </p>
      )}
      {active && !price && active.conditions.length > 0 && (
        <p className="text-xs leading-5 text-[var(--sf-color-muted)]">
          {active.conditions
            .map((condition) =>
              condition === 'MINIMUM' && active.minimumToman !== null
                ? `حداقل خرید ${formatTomanPrice(active.minimumToman)}`
                : labels[condition],
            )
            .join('، ')}
        </p>
      )}
    </>
  );
}
