'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { FiCheck, FiCopy } from 'react-icons/fi';

import {
  customerOrderStatusLabel,
  formatOrderDate,
  orderItemDetails,
  orderStatusLabel,
  paymentMethodLabel,
} from '@/components/account/account-order-presentation';
import type { CustomerOrderDetail } from '@/components/account/account-types';
import { readResponseError, toPersianDigits } from '@/components/account/account-types';
import { CancelPendingOrder } from '@/components/account/cancel-pending-order';
import { CustomerOrderReturns } from '@/components/account/customer-order-returns';
import { RetryOrderPaymentButton } from '@/components/account/retry-order-payment-button';
import { CatalogMedia } from '@/components/catalog/catalog-media';
import { Button, ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { AUTHENTICATION_SUCCEEDED_EVENT, openAuthModal } from '@/lib/auth/events';
import { formatShippingToman, formatTomanPrice } from '@/lib/catalog/presentation';

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

function ShippingTotalRow({
  value,
  payOnDelivery = false,
}: Readonly<{ value: number; payOnDelivery?: boolean }>) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-[var(--sf-color-muted)]">هزینه ارسال</span>
      <span>{payOnDelivery ? 'پس‌کرایه' : formatShippingToman(value)}</span>
    </div>
  );
}

function OrderTimeline({ order }: Readonly<{ order: CustomerOrderDetail }>) {
  const history = order.statusHistory.length
    ? order.statusHistory
    : [{ fromStatus: null, toStatus: order.status, createdAt: order.updatedAt }];
  const awaitingReceiptReview = order.payment?.status === 'AWAITING_REVIEW';

  return (
    <section
      aria-labelledby="order-timeline-heading"
      className="border border-[var(--sf-color-border)] p-5 sm:p-6"
    >
      <h2 id="order-timeline-heading" className="text-xl font-medium">
        روند سفارش
      </h2>
      <ol className="mt-6 space-y-0">
        {history.map((entry, index) => {
          const isCurrentReceiptReview =
            awaitingReceiptReview &&
            index === history.length - 1 &&
            entry.toStatus === 'PENDING_PAYMENT';
          const createdAt = isCurrentReceiptReview
            ? (order.payment?.receiptUploadedAt ?? entry.createdAt)
            : entry.createdAt;

          return (
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
                <p className="font-medium">
                  {isCurrentReceiptReview
                    ? 'در انتظار بررسی رسید'
                    : orderStatusLabel(entry.toStatus)}
                </p>
                <time
                  dateTime={createdAt}
                  className="mt-1 block text-xs text-[var(--sf-color-subtle)]"
                >
                  {formatOrderDate(createdAt, true)}
                </time>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export function canShowCustomerReturns(
  order: Pick<CustomerOrderDetail, 'returnAuthorized' | 'status'>,
): boolean {
  return order.returnAuthorized && (order.status === 'SHIPPED' || order.status === 'DELIVERED');
}

export function canShowCustomerTracking(
  order: Pick<CustomerOrderDetail, 'status' | 'trackingCode'>,
): boolean {
  return order.status !== 'DELIVERED' && Boolean(order.trackingCode);
}

export function CustomerOrderDetailView({ orderId }: Readonly<{ orderId: string }>) {
  const [state, setState] = useState<OrderDetailState>({ status: 'loading' });
  const [trackingCopyStatus, setTrackingCopyStatus] = useState<'idle' | 'copied' | 'failed'>(
    'idle',
  );

  async function copyTrackingCode(trackingCode: string) {
    try {
      await navigator.clipboard.writeText(trackingCode);
      setTrackingCopyStatus('copied');
      window.setTimeout(() => setTrackingCopyStatus('idle'), 2500);
    } catch {
      setTrackingCopyStatus('failed');
    }
  }

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
  const trackingCode = order.status !== 'DELIVERED' ? order.trackingCode : null;

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
          {customerOrderStatusLabel(order)}
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
                      sizes="(min-width: 640px) 112px, 96px"
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

          {order.payment ? (
            <section
              aria-labelledby="order-payment-information-heading"
              className="border border-[var(--sf-color-border)] p-5 sm:p-6"
            >
              <h2 id="order-payment-information-heading" className="text-xl font-medium">
                اطلاعات پرداخت
              </h2>
              <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-[var(--sf-color-subtle)]">شیوه پرداخت</dt>
                  <dd className="mt-1 font-medium">{paymentMethodLabel(order.payment.method)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--sf-color-subtle)]">وضعیت پرداخت</dt>
                  <dd className="mt-1 font-medium">
                    {order.payment.status === 'AWAITING_REVIEW'
                      ? 'در انتظار بررسی رسید'
                      : order.payment.status === 'PAID'
                        ? 'تأییدشده'
                        : 'در انتظار پرداخت'}
                  </dd>
                </div>
              </dl>
              {order.payment.method === 'CARD_TO_CARD' && order.payment.receiptAvailable ? (
                <figure className="mt-6">
                  <div className="overflow-hidden border border-[var(--sf-color-border)] bg-[var(--sf-color-surface)]">
                    {/* eslint-disable-next-line @next/next/no-img-element -- The authenticated receipt URL is dynamic and not suitable for image optimization. */}
                    <img
                      src={`/api/orders/${encodeURIComponent(order.id)}/receipt`}
                      alt="تصویر رسید کارت‌به‌کارت"
                      className="mx-auto max-h-[32rem] w-full object-contain"
                    />
                  </div>
                  <figcaption className="mt-2 text-xs text-[var(--sf-color-subtle)]">
                    {order.payment.receiptOriginalName ?? 'رسید ثبت‌شده پرداخت'}
                  </figcaption>
                </figure>
              ) : null}
            </section>
          ) : null}

          {canShowCustomerReturns(order) ? <CustomerOrderReturns order={order} /> : null}
        </div>

        <aside className="space-y-6 lg:sticky lg:top-24">
          {order.status === 'PENDING_PAYMENT' && order.payment?.status !== 'AWAITING_REVIEW' ? (
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
              <div className="mt-3 border-t border-[var(--sf-color-border)] pt-3">
                <CancelPendingOrder
                  orderId={order.id}
                  onCancelled={(cancelledOrder) =>
                    setState({ status: 'ready', order: cancelledOrder })
                  }
                />
              </div>
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
              <ShippingTotalRow
                value={order.shippingTotalToman}
                payOnDelivery={order.shippingPayOnDelivery}
              />
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

          {trackingCode ? (
            <section
              aria-labelledby="order-tracking-heading"
              className="border border-[var(--sf-color-border)] p-5"
            >
              <h2 id="order-tracking-heading" className="text-xl font-medium">
                رهگیری مرسوله
              </h2>
              {order.shippingMethodName ? (
                <div className="mt-4 flex items-center gap-3">
                  {order.shippingCarrierLogoUrl ? (
                    <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-full border border-[var(--sf-color-border)] bg-white p-1.5">
                      {/* eslint-disable-next-line @next/next/no-img-element -- Admin-uploaded media uses the configured public media origin. */}
                      <img
                        src={order.shippingCarrierLogoUrl}
                        alt=""
                        className="size-full object-contain"
                      />
                    </span>
                  ) : null}
                  <div>
                    <p className="text-xs text-[var(--sf-color-subtle)]">شیوه ارسال</p>
                    <p className="mt-1 font-medium">{toPersianDigits(order.shippingMethodName)}</p>
                  </div>
                </div>
              ) : null}
              <p className="mt-3 text-sm text-[var(--sf-color-muted)]">کد رهگیری</p>
              <div className="mt-2 flex flex-col gap-2 ">
                <p
                  className="min-w-0 flex-1 select-all break-all border border-[var(--sf-color-border)] bg-[var(--sf-color-surface)] px-3 py-2.5 font-medium"
                  dir="ltr"
                >
                  {toPersianDigits(trackingCode)}
                </p>
                <Button
                  variant="outline"
                  className="sm:self-stretch"
                  onClick={() => void copyTrackingCode(trackingCode)}
                >
                  {trackingCopyStatus === 'copied' ? (
                    <FiCheck aria-hidden="true" />
                  ) : (
                    <FiCopy aria-hidden="true" />
                  )}
                  {trackingCopyStatus === 'copied' ? 'کپی شد' : 'کپی کد رهگیری'}
                </Button>
              </div>
              {trackingCopyStatus === 'failed' ? (
                <p role="alert" className="mt-2 text-xs text-red-700">
                  کپی خودکار انجام نشد؛ کد رهگیری را به‌صورت دستی انتخاب و کپی کنید.
                </p>
              ) : (
                <span className="sr-only" role="status" aria-live="polite">
                  {trackingCopyStatus === 'copied' ? 'کد رهگیری کپی شد.' : ''}
                </span>
              )}
              {order.shippingTrackingUrl ? (
                <div className="mt-5 border-t border-[var(--sf-color-border)] pt-4">
                  <p className="text-sm leading-7 text-[var(--sf-color-muted)]">
                    برای مشاهده آخرین وضعیت مرسوله، کد رهگیری را کپی کنید و در وب‌سایت شرکت ارسال
                    وارد کنید.
                  </p>
                  <ButtonLink
                    href={order.shippingTrackingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="solid"
                    className="mt-3 w-full"
                  >
                    استعلام وضعیت
                  </ButtonLink>
                </div>
              ) : null}
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
