'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import {
  formatOrderDate,
  orderItemDetails,
  orderStatusLabel,
} from '@/components/account/account-order-presentation';
import type { CustomerOrderDetail } from '@/components/account/account-types';
import { readResponseError, toPersianDigits } from '@/components/account/account-types';
import { RetryOrderPaymentButton } from '@/components/account/retry-order-payment-button';
import { CatalogMedia } from '@/components/catalog/catalog-media';
import { Button, ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { AUTHENTICATION_SUCCEEDED_EVENT, openAuthModal } from '@/lib/auth/events';
import { formatTomanPrice } from '@/lib/catalog/presentation';

type OrderDetailState =
  | { status: 'loading' }
  | { status: 'anonymous' }
  | { status: 'missing' }
  | { status: 'error'; message: string }
  | { status: 'ready'; order: CustomerOrderDetail };

type TotalRowProps = Readonly<{
  label: string;
  value: number;
  negative?: boolean;
  strong?: boolean;
}>;

function TotalRow({ label, value, negative = false, strong = false }: TotalRowProps) {
  return (
    <div
      className={
        strong
          ? 'flex justify-between gap-4 pt-4 text-base font-bold'
          : 'flex justify-between gap-4 text-sm'
      }
    >
      <span className={strong ? undefined : 'text-[var(--sf-color-muted)]'}>{label}</span>
      <span>
        {negative && value > 0 ? '− ' : ''}
        {formatTomanPrice(value)}
      </span>
    </div>
  );
}

function OrderTimeline({ order }: Readonly<{ order: CustomerOrderDetail }>) {
  const history = order.statusHistory.length
    ? order.statusHistory
    : [{ fromStatus: null, toStatus: order.status, createdAt: order.updatedAt }];

  return (
    <section
      aria-labelledby="order-timeline-heading"
      className="border border-[var(--sf-color-border)] p-5 sm:p-6"
    >
      <h2 id="order-timeline-heading" className="text-xl font-medium">
        روند سفارش
      </h2>
      <ol className="mt-6 space-y-0">
        {history.map((entry, index) => (
          <li
            key={`${entry.toStatus}-${entry.createdAt}-${index}`}
            className="relative grid grid-cols-[1rem_1fr] gap-4 pb-7 last:pb-0"
          >
            {index < history.length - 1 ? (
              <span
                aria-hidden="true"
                className="absolute right-[0.4375rem] top-4 h-[calc(100%-0.25rem)] w-px bg-[var(--sf-color-border-strong)]"
              />
            ) : null}
            <span
              aria-hidden="true"
              className="relative z-10 mt-1 size-4 rounded-full border-4 border-[var(--sf-color-canvas)] bg-[var(--sf-color-ink)] ring-1 ring-[var(--sf-color-ink)]"
            />
            <div>
              <p className="font-medium">{orderStatusLabel(entry.toStatus)}</p>
              <time
                dateTime={entry.createdAt}
                className="mt-1 block text-xs text-[var(--sf-color-subtle)]"
              >
                {formatOrderDate(entry.createdAt, true)}
              </time>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function CustomerOrderDetailView({ orderId }: Readonly<{ orderId: string }>) {
  const [state, setState] = useState<OrderDetailState>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    void fetch(`/api/orders/${encodeURIComponent(orderId)}`, { cache: 'no-store' })
      .then(async (response) => {
        if (!active) return;
        if (response.status === 401) return setState({ status: 'anonymous' });
        if (response.status === 404) return setState({ status: 'missing' });
        if (!response.ok) {
          return setState({ status: 'error', message: await readResponseError(response) });
        }
        setState({ status: 'ready', order: (await response.json()) as CustomerOrderDetail });
      })
      .catch(
        () => active && setState({ status: 'error', message: 'دریافت جزئیات سفارش انجام نشد.' }),
      );

    const reloadAfterAuthentication = () => window.location.reload();
    window.addEventListener(AUTHENTICATION_SUCCEEDED_EVENT, reloadAfterAuthentication);
    return () => {
      active = false;
      window.removeEventListener(AUTHENTICATION_SUCCEEDED_EVENT, reloadAfterAuthentication);
    };
  }, [orderId]);

  if (state.status === 'loading') {
    return (
      <main id="main-content" className="sf-container py-8 sm:py-10">
        <Skeleton className="h-24" />
        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <Skeleton className="h-96" />
          <Skeleton className="h-72" />
        </div>
      </main>
    );
  }

  if (state.status === 'anonymous') {
    return (
      <main id="main-content" className="sf-container">
        <EmptyState
          title="برای مشاهده سفارش وارد شوید"
          description="جزئیات سفارش فقط در حساب خریدار نمایش داده می‌شود."
          action={<Button onClick={openAuthModal}>ورود یا ثبت‌نام</Button>}
        />
      </main>
    );
  }

  if (state.status === 'missing') {
    return (
      <main id="main-content" className="sf-container">
        <EmptyState
          title="سفارش پیدا نشد"
          description="این سفارش وجود ندارد یا متعلق به حساب شما نیست."
          action={<ButtonLink href="/account">بازگشت به سفارش‌ها</ButtonLink>}
        />
      </main>
    );
  }

  if (state.status === 'error') {
    return (
      <main id="main-content" className="sf-container">
        <EmptyState
          title="خطا در دریافت سفارش"
          description={state.message}
          action={<Button onClick={() => window.location.reload()}>تلاش دوباره</Button>}
        />
      </main>
    );
  }

  const { order } = state;
  const address = order.shippingAddress;

  return (
    <main id="main-content" className="sf-container pb-[var(--sf-section-space)] pt-8 sm:pt-10">
      <nav aria-label="مسیر صفحه" className="text-xs text-[var(--sf-color-muted)]">
        <Link href="/account">حساب من</Link>
        <span aria-hidden="true" className="mx-2">
          /
        </span>
        <span>جزئیات سفارش</span>
      </nav>

      <header className="mt-5 flex flex-wrap items-end justify-between gap-5 border-b border-[var(--sf-color-border)] pb-7">
        <div>
          <p className="text-sm text-[var(--sf-color-muted)]">
            سفارش {toPersianDigits(order.orderNumber)}
          </p>
          <h1 className="mt-2 text-3xl font-normal sm:text-4xl">جزئیات سفارش</h1>
          <p className="mt-3 text-sm text-[var(--sf-color-subtle)]">
            ثبت‌شده در {formatOrderDate(order.createdAt, true)}
          </p>
        </div>
        <span className="border border-[var(--sf-color-border-strong)] px-4 py-2 text-sm font-medium">
          {orderStatusLabel(order.status)}
        </span>
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="space-y-6">
          <section
            aria-labelledby="order-items-heading"
            className="border border-[var(--sf-color-border)]"
          >
            <h2
              id="order-items-heading"
              className="border-b border-[var(--sf-color-border)] px-5 py-4 text-xl font-medium"
            >
              کالاهای سفارش
            </h2>
            <ul className="divide-y divide-[var(--sf-color-border)] px-5">
              {order.items.map((item) => (
                <li key={item.id} className="flex gap-4 py-5">
                  <Link
                    href={item.productSlug ? `/products/${item.productSlug}` : '/products'}
                    className="size-24 shrink-0 overflow-hidden bg-[var(--sf-color-surface)] sm:size-28"
                    aria-label={`مشاهده ${toPersianDigits(item.productNameSnapshot)}`}
                  >
                    <CatalogMedia
                      media={item.primaryMedia}
                      fallbackSrc={item.fallbackSrc}
                      alt={toPersianDigits(item.productNameSnapshot)}
                    />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={item.productSlug ? `/products/${item.productSlug}` : '/products'}
                      className="font-medium sm:text-lg"
                    >
                      {toPersianDigits(item.productNameSnapshot)}
                    </Link>
                    <p className="mt-2 text-xs leading-6 text-[var(--sf-color-muted)]">
                      {orderItemDetails(item)}
                    </p>
                    <p className="mt-1 text-xs text-[var(--sf-color-subtle)]">
                      کد کالا: {toPersianDigits(item.skuSnapshot)}
                    </p>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
                      <span className="text-[var(--sf-color-muted)]">
                        قیمت واحد:{' '}
                        {formatTomanPrice(item.unitSalePriceToman + item.unitPlatingPriceToman)}
                      </span>
                      <span className="font-medium">{formatTomanPrice(item.lineTotalToman)}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <OrderTimeline order={order} />
        </div>

        <aside className="space-y-6 lg:sticky lg:top-24">
          {order.status === 'PENDING_PAYMENT' ? (
            <section
              aria-labelledby="order-payment-heading"
              className="border border-[var(--sf-color-ink)] p-5"
            >
              <h2 id="order-payment-heading" className="text-xl font-medium">
                پرداخت سفارش
              </h2>
              <p className="mb-4 mt-2 text-sm leading-7 text-[var(--sf-color-muted)]">
                این سفارش هنوز پرداخت نشده است و تا پایان مهلت رزرو امکان پرداخت دارد.
              </p>
              <RetryOrderPaymentButton
                orderId={order.id}
                reservationExpiresAt={order.reservationExpiresAt}
              />
            </section>
          ) : null}

          <section
            aria-labelledby="order-summary-heading"
            className="border border-[var(--sf-color-border)] p-5"
          >
            <h2 id="order-summary-heading" className="text-xl font-medium">
              خلاصه مبالغ
            </h2>
            <div className="mt-5 space-y-3">
              <TotalRow label="مبلغ کالاها" value={order.merchandiseTotalToman} />
              {order.platingTotalToman > 0 ? (
                <TotalRow label="هزینه آبکاری" value={order.platingTotalToman} />
              ) : null}
              {order.discountTotalToman > 0 ? (
                <TotalRow label="تخفیف" value={order.discountTotalToman} negative />
              ) : null}
              <TotalRow label="هزینه ارسال" value={order.shippingTotalToman} />
              {order.taxTotalToman > 0 ? (
                <TotalRow label="مالیات" value={order.taxTotalToman} />
              ) : null}
            </div>
            <div className="mt-4 border-t border-[var(--sf-color-border)]">
              <TotalRow label="مبلغ نهایی" value={order.grandTotalToman} strong />
            </div>
          </section>

          <section
            aria-labelledby="order-address-heading"
            className="border border-[var(--sf-color-border)] p-5"
          >
            <h2 id="order-address-heading" className="text-xl font-medium">
              نشانی تحویل
            </h2>
            <p className="mt-4 text-sm font-medium">{toPersianDigits(address.recipientName)}</p>
            <p className="mt-2 text-sm leading-7 text-[var(--sf-color-muted)]">
              {toPersianDigits(address.province)}، {toPersianDigits(address.city)}،{' '}
              {toPersianDigits(address.addressLine)}
            </p>
            <p className="mt-3 text-xs leading-6 text-[var(--sf-color-subtle)]" dir="ltr">
              {toPersianDigits(address.phone)} · {toPersianDigits(address.postalCode)}
            </p>
          </section>

          {order.trackingCode ? (
            <section
              aria-labelledby="order-tracking-heading"
              className="border border-[var(--sf-color-border)] p-5"
            >
              <h2 id="order-tracking-heading" className="text-xl font-medium">
                رهگیری مرسوله
              </h2>
              <p className="mt-3 text-sm text-[var(--sf-color-muted)]">کد رهگیری</p>
              <p className="mt-1 font-medium" dir="ltr">
                {toPersianDigits(order.trackingCode)}
              </p>
            </section>
          ) : null}

          <ButtonLink href="/account" variant="outline" className="w-full">
            بازگشت به سفارش‌ها
          </ButtonLink>
        </aside>
      </div>
    </main>
  );
}
