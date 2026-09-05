'use client';

import Link from 'next/link';

import { CatalogMedia } from '@/components/catalog/catalog-media';
import { DiscountBadge } from '@/components/catalog/discount-badge';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { QuantityControl } from '@/components/ui/quantity-control';
import { formatTomanPrice } from '@/lib/catalog/presentation';
import { getDiscountPercent } from '@/lib/catalog/pricing';
import type { CartPlatingType } from '@/lib/cart/cart-state';
import { useCart } from '@/lib/cart/cart-store';

const persianNumber = new Intl.NumberFormat('fa-IR');

const platingLabels: Record<CartPlatingType, string> = {
  GOLD: 'آبکاری طلا',
  RHODIUM: 'آبکاری رودیوم',
};

export default function CartPage() {
  const { items, itemCount, subtotalToman, setQuantity, removeItem } = useCart();

  if (items.length === 0) {
    return (
      <main
        id="main-content"
        className="sf-container pb-32 pt-8 sm:pb-[var(--sf-section-space)] sm:pt-10"
      >
        <EmptyState
          title="سبد خرید شما خالی است"
          description="محصولات موردنظر خود را انتخاب کنید و دوباره به این صفحه برگردید."
          action={
            <ButtonLink href="/products" variant="outline">
              مشاهده محصولات
            </ButtonLink>
          }
        />
      </main>
    );
  }

  return (
    <main
      id="main-content"
      className="sf-container pb-32 pt-8 sm:pb-[var(--sf-section-space)] sm:pt-10"
    >
      <header className="border-b border-[var(--sf-color-border)] pb-8">
        <p className="text-sm text-[var(--sf-color-muted)]">خرید شما</p>
        <h1 className="mt-3 text-4xl font-normal sm:text-5xl">سبد خرید</h1>
        <p className="mt-3 text-sm text-[var(--sf-color-muted)]">
          {persianNumber.format(itemCount)} کالا
        </p>
      </header>

      <div className="grid gap-10 py-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-14">
        <ul className="divide-y divide-[var(--sf-color-border)]">
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
                  />
                </Link>

                <div className="flex min-w-0 flex-col justify-between gap-3">
                  <div>
                    <Link href={`/products/${item.productSlug}`} className="text-base sn:text-lg">
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
                      <p className="mt-1 text-sm text-(--sf-color-muted)">
                        {platingLabels[item.platingType]}
                        {item.platingLeadTimeDays > 0
                          ? ` · ${persianNumber.format(item.platingLeadTimeDays)} روز آماده‌سازی`
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
            <span className="text-xl font-semibold">{formatTomanPrice(subtotalToman)}</span>
          </div>
          <div className="mt-6 grid gap-3">
            <ButtonLink href="/checkout" variant="solid" className="w-full">
              ثبت سفارش
            </ButtonLink>
          </div>
        </aside>
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

              <p className="text-xl font-bold">{formatTomanPrice(subtotalToman)}</p>
            </div>

            <ButtonLink href="/checkout" variant="solid" className="flex-1">
              ثبت سفارش
            </ButtonLink>
          </div>
        </div>
      </div>
    </main>
  );
}
