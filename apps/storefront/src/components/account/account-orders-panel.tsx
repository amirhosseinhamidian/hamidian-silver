'use client';

import Link from 'next/link';

import {
  formatOrderDate,
  orderItemDetails,
  orderStatusLabel,
} from '@/components/account/account-order-presentation';
import type { CustomerOrder } from '@/components/account/account-types';
import { toPersianDigits } from '@/components/account/account-types';
import { CatalogMedia } from '@/components/catalog/catalog-media';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { formatTomanPrice } from '@/lib/catalog/presentation';

export function AccountOrdersPanel({ orders }: Readonly<{ orders: CustomerOrder[] }>) {
  return (
    <section aria-labelledby="account-orders-heading">
      <div className="border-b border-[var(--sf-color-border)] pb-5">
        <h2 id="account-orders-heading" className="text-2xl font-medium">
          سفارش‌ها
        </h2>
        <p className="mt-2 text-sm leading-7 text-[var(--sf-color-muted)]">
          وضعیت سفارش‌ها و کد رهگیری مرسوله را اینجا مشاهده کنید.
        </p>
      </div>

      {orders.length === 0 ? (
        <EmptyState
          title="هنوز سفارشی ثبت نکرده‌اید"
          action={<ButtonLink href="/products">مشاهده محصولات</ButtonLink>}
        />
      ) : (
        <ul className="space-y-5 pt-6">
          {orders.map((order) => (
            <li key={order.id} className="border border-[var(--sf-color-border)]">
              <header className="grid gap-3 border-b border-[var(--sf-color-border)] bg-[var(--sf-color-surface)] p-4 text-sm sm:grid-cols-4 sm:items-center">
                <div>
                  <span className="block text-xs text-[var(--sf-color-subtle)]">شماره سفارش</span>
                  <span className="mt-1 block font-medium" dir="ltr">
                    {toPersianDigits(order.orderNumber)}
                  </span>
                </div>
                <div>
                  <span className="block text-xs text-[var(--sf-color-subtle)]">تاریخ</span>
                  <span className="mt-1 block">{formatOrderDate(order.createdAt)}</span>
                </div>
                <div>
                  <span className="block text-xs text-[var(--sf-color-subtle)]">وضعیت</span>
                  <span className="mt-1 block font-medium">{orderStatusLabel(order.status)}</span>
                </div>
                <div className="sm:text-left">
                  <span className="block text-xs text-[var(--sf-color-subtle)]">مبلغ کل</span>
                  <span className="mt-1 block font-medium">
                    {formatTomanPrice(order.grandTotalToman)}
                  </span>
                </div>
              </header>

              <ul className="divide-y divide-[var(--sf-color-border)] px-4">
                {order.items.map((item) => (
                  <li key={item.id} className="flex gap-4 py-4">
                    <Link
                      href={item.productSlug ? `/products/${item.productSlug}` : '/products'}
                      aria-label={`مشاهده ${toPersianDigits(item.productNameSnapshot)}`}
                      className="size-20 shrink-0 overflow-hidden bg-[var(--sf-color-surface)] sm:size-24"
                    >
                      <CatalogMedia
                        media={item.primaryMedia}
                        fallbackSrc={item.fallbackSrc}
                        alt={toPersianDigits(item.productNameSnapshot)}
                        sizes="(min-width: 640px) 96px, 80px"
                      />
                    </Link>
                    <div className="min-w-0 flex-1 py-1">
                      <Link
                        href={item.productSlug ? `/products/${item.productSlug}` : '/products'}
                        className="font-medium"
                      >
                        {toPersianDigits(item.productNameSnapshot)}
                      </Link>
                      <p className="mt-2 text-xs leading-6 text-[var(--sf-color-muted)]">
                        {orderItemDetails(item)}
                      </p>
                      <p className="mt-2 text-sm">{formatTomanPrice(item.lineTotalToman)}</p>
                    </div>
                  </li>
                ))}
              </ul>

              <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--sf-color-border)] px-4 py-3 text-sm">
                {order.trackingCode ? (
                  <p>
                    کد رهگیری:{' '}
                    <span className="font-medium" dir="ltr">
                      {toPersianDigits(order.trackingCode)}
                    </span>
                  </p>
                ) : (
                  <span className="text-[var(--sf-color-subtle)]">کد رهگیری ثبت نشده است.</span>
                )}
                <Link
                  href={`/account/orders/${order.id}`}
                  className="border-b border-[var(--sf-color-border-strong)] font-medium hover:border-[var(--sf-color-ink)]"
                >
                  مشاهده جزئیات سفارش
                </Link>
              </footer>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
