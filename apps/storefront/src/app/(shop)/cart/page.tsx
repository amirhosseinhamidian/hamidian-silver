'use client';

import Link from 'next/link';
import type { components } from '@hamidian/contracts';
import { useEffect, useState } from 'react';

import { CartRecoveryPanel } from '@/components/cart/cart-recovery-panel';
import { CatalogMedia } from '@/components/catalog/catalog-media';
import { DiscountBadge } from '@/components/catalog/discount-badge';
import { ProductRecommendations } from '@/components/catalog/product-recommendations';
import { PlatingTypeIndicator } from '@/components/plating/plating-type-indicator';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { QuantityControl } from '@/components/ui/quantity-control';
import { CartWalletPreview } from '@/components/wallet/cart-wallet-preview';
import { formatTomanPrice } from '@/lib/catalog/presentation';
import { getDiscountPercent } from '@/lib/catalog/pricing';
import { useCart } from '@/lib/cart/cart-store';
import { usePromotions } from '@/lib/promotions/promotion-context';

const persianNumber = new Intl.NumberFormat('fa-IR');

export default function CartPage() {
  const { items, itemCount, subtotalToman, setQuantity, removeItem } = useCart();

  const { items: publicOffers } = usePromotions();
  const [estimate, setEstimate] = useState<{
    request: string;
    value: components['schemas']['PromotionEstimateDto'];
  } | null>(null);
  const cartRequest = JSON.stringify({
    items: items.map(({ variantId, quantity, platingType }) => ({
      variantId,
      quantity,
      ...(platingType ? { platingType } : {}),
    })),
  });
  const request = items.length > 0 && publicOffers.length > 0 ? cartRequest : null;

  useEffect(() => {
    if (!request) return;
    const controller = new AbortController();
    void fetch('/api/cart/promotion-estimate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: request,
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.ok) {
          const value = (await response.json()) as components['schemas']['PromotionEstimateDto'];
          if (!controller.signal.aborted) setEstimate({ request, value });
        }
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [request]);
  const offer =
    estimate?.request === request && estimate?.value.discountTotalToman ? estimate.value : null;
  const cartTotal = offer?.payableToman ?? subtotalToman;
  const discount = offer && (
    <p className="mt-1 text-xs text-[var(--sf-color-muted)]">
      {offer.campaignName} · {formatTomanPrice(offer.discountTotalToman)} تخفیف
    </p>
  );

  return (
    <main
      id="main-content"
      className="sf-container pb-32 pt-8 sm:pb-[var(--sf-section-space)] sm:pt-10"
    >
      {items.length === 0 ? (
        <EmptyState
          title="سبد خرید شما خالی است"
          description="محصولات موردنظر خود را انتخاب کنید و دوباره به این صفحه برگردید."
          action={
            <ButtonLink href="/products" variant="outline">
              مشاهده محصولات
            </ButtonLink>
          }
        />
      ) : (
        <header className="border-b border-[var(--sf-color-border)] pb-8">
          <p className="text-sm text-[var(--sf-color-muted)]">خرید شما</p>
          <h1 className="mt-3 text-4xl font-normal sm:text-5xl">سبد خرید</h1>
          <p className="mt-3 text-sm text-[var(--sf-color-muted)]">
            {persianNumber.format(itemCount)} کالا
          </p>
        </header>
      )}

      <CartRecoveryPanel items={items} />
      {items.length > 0 && (
        <>
          <div className="grid gap-10 py-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-14">
            <ul className="divide-y divide-[var(--sf-color-border)] lg:row-span-2">
              {items.map((item) => {
                const lineTotal =
                  (item.unitSalePriceToman + item.unitPlatingPriceToman) * item.quantity;
                const discountPercent = getDiscountPercent(
                  item.unitCompareAtPriceToman,
                  item.unitSalePriceToman,
                );

                return (
                  <li
                    key={item.key}
                    className="
                grid grid-cols-[4.5rem_minmax(0,1fr)]
                gap-3
                py-4
                sm:grid-cols-[8rem_minmax(0,1fr)]
                "
                  >
                    <Link
                      href={`/products/${item.productSlug}`}
                      className="aspect-square overflow-hidden rounded-sm bg-(--sf-color-surface)"
                      aria-label={`مشاهده ${item.productName}`}
                    >
                      <CatalogMedia
                        media={item.media}
                        fallbackSrc={
                          process.env.NODE_ENV === 'development'
                            ? `/dev-catalog/products/${item.productSlug}.webp`
                            : null
                        }
                        alt={item.productName}
                        sizes="(min-width: 640px) 128px, 72px"
                      />
                    </Link>

                    <div className="flex min-w-0 flex-col justify-between gap-3">
                      <div>
                        <Link
                          href={`/products/${item.productSlug}`}
                          className="text-base sn:text-lg"
                        >
                          {item.productName}
                        </Link>
                        {item.variantLabel ? (
                          <p className="mt-2 text-sm text-(--sf-color-muted)">
                            {item.variantLabel.includes(':')
                              ? item.variantLabel
                              : `گزینه: ${item.variantLabel}`}
                          </p>
                        ) : null}
                        {item.platingType ? (
                          <p className="mt-1 flex flex-wrap items-center gap-1 text-sm text-(--sf-color-muted)">
                            <PlatingTypeIndicator type={item.platingType} />
                            {item.platingLeadTimeDays > 0
                              ? `· ${persianNumber.format(item.platingLeadTimeDays)} روز آماده‌سازی`
                              : ''}
                          </p>
                        ) : null}
                        {discountPercent !== null ? (
                          <div className="mt-2 flex items-center gap-2 text-xs text-(--sf-color-muted)">
                            <span className="line-through">
                              {formatTomanPrice(item.unitCompareAtPriceToman)}
                            </span>
                            <DiscountBadge percent={discountPercent} />
                          </div>
                        ) : null}
                        <p
                          className={
                            discountPercent !== null
                              ? 'mt-1 text-sm font-medium'
                              : 'mt-2 text-sm font-medium'
                          }
                        >
                          {formatTomanPrice(item.unitSalePriceToman + item.unitPlatingPriceToman)}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <QuantityControl
                          value={item.quantity}
                          max={item.maxQuantity}
                          onChange={(quantity) => setQuantity(item.key, quantity)}
                          onRemove={() => removeItem(item.key)}
                          label={`تعداد ${item.productName}`}
                        />

                        <div>
                          <p className="text-xs text-(--sf-color-muted)">جمع این مورد</p>
                          <p className="mt-1 text-sm">{formatTomanPrice(lineTotal)}</p>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            <aside className="hidden h-fit mt-8 border border-[var(--sf-color-border)] p-5 lg:sticky lg:top-20 lg:mt-14 lg:block">
              <h2 className="text-lg font-medium">خلاصه سبد</h2>
              <div className="mt-5 flex items-center justify-between gap-4 text-sm">
                <span className="text-[var(--sf-color-muted)]">مجموع کالاها</span>
                <span className="text-xl font-semibold">{formatTomanPrice(cartTotal)}</span>
              </div>
              {discount}
              <div className="mt-6 grid gap-3">
                <ButtonLink href="/checkout" variant="solid" className="w-full">
                  ثبت سفارش
                </ButtonLink>
              </div>
            </aside>
            <CartWalletPreview request={cartRequest} />
            <div
              className="
            fixed inset-x-0 bottom-0 z-40
            border-t border-[var(--sf-color-border)]
            bg-white
            p-4
            shadow-[0_-8px_24px_rgba(0,0,0,0.08)]
            lg:hidden
          "
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs text-[var(--sf-color-muted)]">مجموع</p>

                  <p className="text-xl font-bold">{formatTomanPrice(cartTotal)}</p>
                  {discount}
                </div>

                <ButtonLink href="/checkout" variant="solid" className="flex-1">
                  ثبت سفارش
                </ButtonLink>
              </div>
            </div>
          </div>
          <ProductRecommendations
            list="cart_recommendations"
            sources={items.map(({ productSlug }) => productSlug)}
          />
        </>
      )}
    </main>
  );
}
