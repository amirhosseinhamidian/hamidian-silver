import Link from 'next/link';
import { FiAlertTriangle, FiCheck, FiClock, FiMapPin, FiPackage } from 'react-icons/fi';

import {
  formatOrderDate,
  orderItemDetails,
  orderStatusLabel,
} from '@/components/account/account-order-presentation';
import type { CustomerOrderDetail } from '@/components/account/account-types';
import { toPersianDigits } from '@/components/account/account-types';
import { CatalogMedia } from '@/components/catalog/catalog-media';
import { ButtonLink } from '@/components/ui/button';
import { formatTomanPrice } from '@/lib/catalog/presentation';

export type PaymentResultStatus = 'success' | 'pending' | 'failed';

type PaymentResultProps = Readonly<{
  status: PaymentResultStatus;
  orderId?: string;
  order?: CustomerOrderDetail | null;
}>;

const RESULT_CONTENT: Record<
  PaymentResultStatus,
  Readonly<{
    eyebrow: string;
    title: string;
    description: string;
    icon: typeof FiCheck;
  }>
> = {
  success: {
    eyebrow: 'پرداخت موفق',
    title: 'خرید شما با موفقیت تکمیل شد',
    description: 'پرداخت تأیید شده و سفارش برای آماده‌سازی به گالری ارسال شده است.',
    icon: FiCheck,
  },
  pending: {
    eyebrow: 'بررسی پرداخت',
    title: 'نتیجه پرداخت در حال بررسی است',
    description:
      'تا مشخص‌شدن وضعیت نهایی، پرداخت را تکرار نکنید. نتیجه از حساب کاربری قابل پیگیری است.',
    icon: FiClock,
  },
  failed: {
    eyebrow: 'پرداخت ناموفق',
    title: 'پرداخت تکمیل نشد',
    description:
      'پرداختی از سمت فروشگاه تأیید نشده است. در صورت کسر مبلغ، ابتدا وضعیت سفارش را بررسی کنید.',
    icon: FiAlertTriangle,
  },
};

function resultActionLabel(status: PaymentResultStatus): string {
  if (status === 'success') return 'مشاهده جزئیات سفارش';
  if (status === 'pending') return 'بررسی وضعیت سفارش';
  return 'بررسی و تلاش مجدد';
}

function OrderItems({ order }: Readonly<{ order: CustomerOrderDetail }>) {
  return (
    <section
      aria-labelledby="completed-order-items"
      className="border border-[var(--sf-color-border)]"
    >
      <div className="flex items-center justify-between gap-4 border-b border-[var(--sf-color-border)] px-5 py-4 sm:px-6">
        <h2 id="completed-order-items" className="text-xl font-medium">
          کالاهای سفارش
        </h2>
        <span className="text-xs text-[var(--sf-color-muted)]">
          {toPersianDigits(order.items.reduce((sum, item) => sum + item.quantity, 0))} کالا
        </span>
      </div>
      <ul className="divide-y divide-[var(--sf-color-border)] px-5 sm:px-6">
        {order.items.map((item) => (
          <li key={item.id} className="flex gap-4 py-5">
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
            <div className="min-w-0 flex-1">
              <Link
                href={item.productSlug ? `/products/${item.productSlug}` : '/products'}
                className="font-medium"
              >
                {toPersianDigits(item.productNameSnapshot)}
              </Link>
              <p className="mt-2 text-xs leading-6 text-[var(--sf-color-muted)]">
                {orderItemDetails(item)}
              </p>
              <p className="mt-3 text-sm font-medium">{formatTomanPrice(item.lineTotalToman)}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function NextSteps({ status }: Readonly<{ status: PaymentResultStatus }>) {
  if (status !== 'success') return null;

  const steps = [
    {
      title: 'پرداخت تأیید شد',
      description: 'سفارش شما ثبت شده و پرداخت آن با موفقیت تأیید شده است.',
    },
    {
      title: 'آماده‌سازی سفارش',
      description: 'محصولات بررسی و با توجه به آبکاری انتخابی برای ارسال آماده می‌شوند.',
    },
    {
      title: 'ارسال و رهگیری',
      description: 'پس از ارسال، کد رهگیری در جزئیات سفارش حساب کاربری نمایش داده می‌شود.',
    },
  ];

  return (
    <section
      aria-labelledby="completed-order-next-steps"
      className="border border-[var(--sf-color-border)] p-5 sm:p-6"
    >
      <h2 id="completed-order-next-steps" className="text-xl font-medium">
        از اینجا به بعد
      </h2>
      <ol className="mt-7 grid gap-6 sm:grid-cols-3">
        {steps.map((step, index) => (
          <li key={step.title} className="border-t border-[var(--sf-color-border)] pt-5">
            <span className="text-xs text-[var(--sf-color-subtle)]">
              {toPersianDigits(String(index + 1).padStart(2, '0'))}
            </span>
            <h3 className="mt-3 text-sm font-medium">{step.title}</h3>
            <p className="mt-2 text-xs leading-6 text-[var(--sf-color-muted)]">
              {step.description}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function OrderSummary({ order }: Readonly<{ order: CustomerOrderDetail }>) {
  const address = order.shippingAddress;

  return (
    <aside className="space-y-5 lg:sticky lg:top-24">
      <section
        aria-labelledby="completed-order-summary"
        className="border border-[var(--sf-color-border)] p-5"
      >
        <h2 id="completed-order-summary" className="text-lg font-medium">
          خلاصه سفارش
        </h2>
        <dl className="mt-5 space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-[var(--sf-color-muted)]">شماره سفارش</dt>
            <dd className="font-medium" dir="ltr">
              {toPersianDigits(order.orderNumber)}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[var(--sf-color-muted)]">تاریخ ثبت</dt>
            <dd>{formatOrderDate(order.createdAt)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[var(--sf-color-muted)]">وضعیت سفارش</dt>
            <dd>{orderStatusLabel(order.status)}</dd>
          </div>
        </dl>
        <div className="mt-5 flex items-end justify-between gap-4 border-t border-[var(--sf-color-border)] pt-5">
          <span className="text-sm text-[var(--sf-color-muted)]">مبلغ نهایی</span>
          <strong className="text-lg">{formatTomanPrice(order.grandTotalToman)}</strong>
        </div>
      </section>

      <section
        aria-labelledby="completed-order-address"
        className="border border-[var(--sf-color-border)] p-5"
      >
        <div className="flex items-center gap-3">
          <FiMapPin aria-hidden="true" size={18} />
          <h2 id="completed-order-address" className="text-lg font-medium">
            نشانی تحویل
          </h2>
        </div>
        <p className="mt-4 text-sm font-medium">{toPersianDigits(address.recipientName)}</p>
        <p className="mt-2 text-sm leading-7 text-[var(--sf-color-muted)]">
          {toPersianDigits(address.province)}، {toPersianDigits(address.city)}،{' '}
          {toPersianDigits(address.addressLine)}
        </p>
        <p className="mt-3 text-xs text-[var(--sf-color-subtle)]" dir="ltr">
          {toPersianDigits(address.phone)} · {toPersianDigits(address.postalCode)}
        </p>
      </section>
    </aside>
  );
}

export function PaymentResult({ status, orderId, order = null }: PaymentResultProps) {
  const content = RESULT_CONTENT[status];
  const StatusIcon = content.icon;
  const resolvedOrderId = order?.id ?? orderId;

  return (
    <main id="main-content" className="pb-[var(--sf-section-space)]">
      <header className="border-b border-[var(--sf-color-border)] bg-[var(--sf-color-surface)]">
        <div className="sf-container py-12 text-center sm:py-18">
          <span
            className={`mx-auto flex size-14 items-center justify-center rounded-full border ${status === 'success' ? 'border-[var(--sf-color-ink)] bg-[var(--sf-color-ink)] text-white' : 'border-[var(--sf-color-border-strong)] bg-[var(--sf-color-canvas)]'}`}
          >
            <StatusIcon aria-hidden="true" size={24} />
          </span>
          <p className="mt-6 text-xs font-medium tracking-[0.18em] text-[var(--sf-color-muted)]">
            {content.eyebrow}
          </p>
          <h1 className="mt-4 text-3xl font-normal sm:text-5xl">{content.title}</h1>
          {order ? (
            <p className="mt-4 text-sm font-medium">
              سفارش <span dir="ltr">{toPersianDigits(order.orderNumber)}</span>
            </p>
          ) : null}
          <p className="mx-auto mt-5 max-w-2xl text-sm leading-8 text-[var(--sf-color-muted)] sm:text-base">
            {content.description}
          </p>
        </div>
      </header>

      {order ? (
        <div className="sf-container grid gap-6 pt-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:pt-12">
          <div className="space-y-6">
            <OrderItems order={order} />
            <NextSteps status={status} />
          </div>
          <OrderSummary order={order} />
        </div>
      ) : (
        <section className="sf-container py-10 text-center sm:py-14">
          <div className="mx-auto max-w-2xl border border-[var(--sf-color-border)] px-6 py-10 sm:px-12">
            <FiPackage
              aria-hidden="true"
              className="mx-auto text-[var(--sf-color-muted)]"
              size={28}
            />
            <p className="mt-5 text-sm leading-8 text-[var(--sf-color-muted)]">
              برای مشاهده مبلغ، کالاها و نشانی تحویل، جزئیات سفارش را از حساب کاربری باز کنید.
            </p>
          </div>
        </section>
      )}

      <div className="sf-container mt-8 flex flex-col justify-center gap-3 sm:flex-row lg:mt-10">
        {resolvedOrderId ? (
          <ButtonLink
            href={`/account/orders/${encodeURIComponent(resolvedOrderId)}`}
            variant="solid"
          >
            {resultActionLabel(status)}
          </ButtonLink>
        ) : (
          <ButtonLink href="/account" variant="solid">
            مشاهده سفارش‌ها
          </ButtonLink>
        )}
        <ButtonLink href="/products">ادامه خرید</ButtonLink>
      </div>
    </main>
  );
}
