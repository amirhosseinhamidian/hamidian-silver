'use client';

import Link from 'next/link';

import { CatalogMedia } from '@/components/catalog/catalog-media';
import { Button, ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { QuantityControl } from '@/components/ui/quantity-control';
import { formatTomanPrice } from '@/lib/catalog/presentation';
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
      <main id="main-content" className="sf-container py-[var(--sf-section-space)]">
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
    <main id="main-content" className="sf-container py-[var(--sf-section-space)]">
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

            return (
              <li key={item.key} className="grid gap-5 py-6 sm:grid-cols-[8rem_minmax(0,1fr)]">
                <Link
                  href={`/products/${item.productSlug}`}
                  className="aspect-[4/5] overflow-hidden bg-[var(--sf-color-surface)]"
                  aria-label={`مشاهده ${item.productName}`}
                >
                  <CatalogMedia media={item.media} alt={item.productName} />
                </Link>

                <div className="flex min-w-0 flex-col justify-between gap-5">
                  <div>
                    <Link href={`/products/${item.productSlug}`} className="text-lg">
                      {item.productName}
                    </Link>
                    <p className="mt-2 text-sm text-[var(--sf-color-muted)]">
                      {item.variantLabel}
                    </p>
                    {item.platingType ? (
                      <p className="mt-1 text-sm text-[var(--sf-color-muted)]">
                        {platingLabels[item.platingType]}
                        {item.platingLeadTimeDays > 0
                          ? ` · ${persianNumber.format(item.platingLeadTimeDays)} روز آماده‌سازی`
                          : ''}
                      </p>
                    ) : null}
                    <p className="mt-3 text-sm">
                      {formatTomanPrice(item.unitSalePriceToman + item.unitPlatingPriceToman)}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-end justify-between gap-4">
                    <QuantityControl
                      value={item.quantity}
                      max={item.maxQuantity}
                      onChange={(quantity) => setQuantity(item.key, quantity)}
                      label={`تعداد ${item.productName}`}
                    />

                    <div className="text-left">
                      <p className="text-xs text-[var(--sf-color-muted)]">جمع این مورد</p>
                      <p className="mt-1 text-sm">{formatTomanPrice(lineTotal)}</p>
                      <Button
                        type="button"
                        variant="text"
                        size="sm"
                        className="mt-2"
                        onClick={() => removeItem(item.key)}
                      >
                        حذف
                      </Button>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        <aside className="h-fit border border-[var(--sf-color-border)] p-5 lg:sticky lg:top-6">
          <h2 className="text-lg font-medium">خلاصه سبد</h2>
          <div className="mt-5 flex items-center justify-between gap-4 text-sm">
            <span className="text-[var(--sf-color-muted)]">مجموع کالاها</span>
            <span>{formatTomanPrice(subtotalToman)}</span>
          </div>
          <p className="mt-5 text-xs leading-6 text-[var(--sf-color-muted)]">
            قیمت و موجودی نهایی هنگام ثبت سفارش دوباره توسط سرور بررسی می‌شود.
          </p>
          <div className="mt-6">
            <ButtonLink href="/products" variant="outline" className="w-full">
              ادامه خرید
            </ButtonLink>
          </div>
        </aside>
      </div>
    </main>
  );
}
