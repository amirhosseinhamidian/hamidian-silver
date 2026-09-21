'use client';

import { useMemo, useState } from 'react';

import { OrderOperations } from '@/components/orders/order-operations';
import { PaymentReceiptReview } from '@/components/orders/payment-receipt-review';
import { Alert } from '@/components/ui/alert';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { BottomSheet, BottomSheetContent, BottomSheetTrigger } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { DataTableColumn } from '@/components/ui/data-table';
import { DonutChart } from '@/components/ui/donut-chart';
import { FilterBar, SearchField } from '@/components/ui/filter-bar';
import { MobileDataCard } from '@/components/ui/mobile-data-card';
import { ResponsiveDataView } from '@/components/ui/responsive-data-view';
import { Select } from '@/components/ui/select';
import {
  orderItemCount,
  orderRequiresAttention,
  type AdminOrder,
  type AdminOrderItem,
  type AdminOrderStatus,
  type AdminPaymentAttemptStatus,
  type AdminPaymentStatus,
  type AdminShipmentStatus,
} from '@/lib/orders/orders-model';
import { platingTypeLabel } from '@/lib/plating/plating-model';
import {
  formatAdminDateTime,
  formatAdminInteger,
  formatAdminPhone,
  formatAdminToman,
  toAsciiDigits,
  toPersianDigits,
} from '@/lib/presentation/formatters';

type OrderManagementViewProps = Readonly<{
  orders: readonly AdminOrder[];
  failed: boolean;
  canUpdateStatus?: boolean;
  canCancel?: boolean;
  initialOrderId?: string;
}>;

const orderStatusPresentation: Record<AdminOrderStatus, { label: string; tone: BadgeTone }> = {
  PENDING_PAYMENT: { label: 'در انتظار پرداخت', tone: 'warning' },
  PAID: { label: 'پرداخت‌شده', tone: 'info' },
  PROCESSING: { label: 'در حال پردازش', tone: 'info' },
  SHIPPED: { label: 'ارسال‌شده', tone: 'neutral' },
  DELIVERED: { label: 'تحویل‌شده', tone: 'success' },
  CANCELLED: { label: 'لغوشده', tone: 'danger' },
  EXPIRED: { label: 'منقضی‌شده', tone: 'neutral' },
};

const paymentStatusPresentation: Record<AdminPaymentStatus, { label: string; tone: BadgeTone }> = {
  PENDING: { label: 'در انتظار پرداخت', tone: 'warning' },
  AWAITING_REVIEW: { label: 'در انتظار بررسی رسید', tone: 'warning' },
  PAID: { label: 'تسویه‌شده', tone: 'success' },
  PARTIALLY_REFUNDED: { label: 'بازپرداخت جزئی', tone: 'warning' },
  CANCELLED: { label: 'لغوشده', tone: 'neutral' },
  RECONCILIATION_REQUIRED: { label: 'نیازمند مغایرت‌گیری', tone: 'danger' },
  REFUNDED: { label: 'بازپرداخت‌شده', tone: 'info' },
};

const attemptStatusPresentation: Record<AdminPaymentAttemptStatus, string> = {
  CREATED: 'ایجادشده',
  REDIRECTED: 'هدایت به درگاه',
  AWAITING_REVIEW: 'رسید در انتظار تأیید',
  VERIFIED: 'تأییدشده',
  FAILED: 'ناموفق',
  RECONCILIATION_REQUIRED: 'نیازمند مغایرت‌گیری',
  RECONCILED: 'مغایرت رفع‌شده',
};

const shipmentStatusPresentation: Record<AdminShipmentStatus, string> = {
  PENDING: 'در انتظار آماده‌سازی',
  READY: 'آماده تحویل',
  HANDED_OVER: 'تحویل به ارسال‌کننده',
  IN_TRANSIT: 'در مسیر',
  DELIVERED: 'تحویل‌شده',
  FAILED: 'ناموفق',
  CANCELLED: 'لغوشده',
};

const decimalFormatter = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 3 });

function paymentMethodLabel(provider: string | undefined): string {
  if (!provider) return 'ثبت نشده';
  if (provider.toLowerCase() === 'card_to_card') return 'کارت‌به‌کارت';
  return 'درگاه بانکی';
}

function paymentProviderLabel(provider: string): string {
  return provider.toLowerCase() === 'card_to_card' ? 'کارت‌به‌کارت' : provider;
}

function timelineStatusLabel(
  order: AdminOrder,
  entry: AdminOrder['timeline'][number],
  index: number,
): string {
  const isCardToCard = order.payment?.attempts[0]?.provider.toLowerCase() === 'card_to_card';
  if (!isCardToCard || entry.toStatus !== 'PENDING_PAYMENT') {
    return orderStatusPresentation[entry.toStatus].label;
  }

  const isCurrentReviewStep =
    order.payment?.status === 'AWAITING_REVIEW' && index === order.timeline.length - 1;
  return isCurrentReviewStep ? 'در انتظار بررسی رسید' : 'در انتظار ثبت رسید کارت‌به‌کارت';
}

function OrderStatusBadge({ order }: Readonly<{ order: AdminOrder }>) {
  const presentation =
    order.status === 'PENDING_PAYMENT' && order.payment?.status === 'AWAITING_REVIEW'
      ? { label: 'در انتظار بررسی رسید', tone: 'warning' as const }
      : orderStatusPresentation[order.status];
  return (
    <Badge tone={presentation.tone} dot>
      {presentation.label}
    </Badge>
  );
}

function PaymentStatusBadge({ order }: Readonly<{ order: AdminOrder }>) {
  if (!order.payment) return <Badge tone="neutral">بدون رکورد پرداخت</Badge>;

  if (order.payment.attempts.some((attempt) => attempt.status === 'AWAITING_REVIEW')) {
    return (
      <Badge tone="warning" dot>
        رسید در انتظار تأیید
      </Badge>
    );
  }

  const presentation = paymentStatusPresentation[order.payment.status];
  return (
    <Badge tone={presentation.tone} dot>
      {presentation.label}
    </Badge>
  );
}

function DetailRows({ rows }: Readonly<{ rows: readonly (readonly [string, string | number])[] }>) {
  return (
    <dl className="divide-y divide-[var(--admin-color-border)]">
      {rows.map(([label, value]) => (
        <div key={label} className="flex justify-between gap-4 py-2.5 text-xs sm:text-sm">
          <dt className="text-[var(--admin-color-muted)]">{label}</dt>
          <dd className="max-w-[68%] text-left font-semibold break-words">
            {typeof value === 'string' ? toPersianDigits(value) : formatAdminInteger(value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function OrderItemCard({ item }: Readonly<{ item: AdminOrderItem }>) {
  return (
    <article className="rounded-[var(--admin-radius-md)] border border-[var(--admin-color-border)] p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="font-bold">{toPersianDigits(item.productName)}</h4>
          <p className="mt-1 text-xs text-[var(--admin-color-muted)]">
            {item.variantName ? `${toPersianDigits(item.variantName)} · ` : ''}
            کد {toPersianDigits(item.sku)}
            {item.sizeLabel ? ` · سایز ${toPersianDigits(item.sizeLabel)}` : ''}
          </p>
        </div>
        <Badge tone="neutral">{formatAdminInteger(item.quantity)} عدد</Badge>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg bg-[var(--admin-color-surface-subtle)] p-2.5">
          <p className="text-[var(--admin-color-subtle)]">قیمت واحد</p>
          <p className="mt-1 font-bold">{formatAdminToman(item.unitSalePriceToman)}</p>
        </div>
        <div className="rounded-lg bg-[var(--admin-color-surface-subtle)] p-2.5">
          <p className="text-[var(--admin-color-subtle)]">جمع ردیف</p>
          <p className="mt-1 font-bold">{formatAdminToman(item.lineTotalToman)}</p>
        </div>
      </div>
      {item.platingType || item.unitWeightGrams !== null || item.supplierName ? (
        <p className="mt-3 text-xs leading-6 text-[var(--admin-color-muted)]">
          {item.platingType
            ? `${platingTypeLabel(item.platingType)}: ${formatAdminToman(item.unitPlatingPriceToman)}`
            : 'بدون آبکاری'}
          {item.unitWeightGrams !== null
            ? ` · وزن ${decimalFormatter.format(item.unitWeightGrams)} گرم`
            : ''}
          {item.supplierName ? ` · تأمین‌کننده ${toPersianDigits(item.supplierName)}` : ''}
        </p>
      ) : null}
    </article>
  );
}

function OrderDetails({
  order,
  canUpdateStatus,
  canCancel,
}: Readonly<{
  order: AdminOrder;
  canUpdateStatus: boolean;
  canCancel: boolean;
}>) {
  const latestAttempt = order.payment?.attempts[0];
  const isAwaitingCardToCardReview =
    order.payment?.status === 'AWAITING_REVIEW' &&
    latestAttempt?.provider.toLowerCase() === 'card_to_card';
  return (
    <div className="space-y-4">
      {orderRequiresAttention(order) ? (
        <Alert tone="danger" title="این سفارش نیازمند بررسی است">
          وضعیت پرداخت یا ارسال با روند عادی سفارش سازگار نیست.
        </Alert>
      ) : null}

      {isAwaitingCardToCardReview ? (
        <Alert tone="warning" title="پرداخت کارت‌به‌کارت ثبت شده است">
          رسید مشتری دریافت شده و تا زمان تأیید مدیر در صف بررسی می‌ماند.
        </Alert>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <OrderStatusBadge order={order} />
        <PaymentStatusBadge order={order} />
        {order.shipment ? (
          <Badge tone={order.shipment.status === 'FAILED' ? 'danger' : 'neutral'}>
            ارسال: {shipmentStatusPresentation[order.shipment.status]}
          </Badge>
        ) : null}
      </div>

      <OrderOperations order={order} canUpdateStatus={canUpdateStatus} canCancel={canCancel} />

      <Card title="خلاصه مالی" description="مبالغ ثبت‌شده در زمان سفارش">
        <DetailRows
          rows={[
            ['مبلغ کالا', formatAdminToman(order.merchandiseTotalToman)],
            ['آبکاری', formatAdminToman(order.platingTotalToman)],
            ['تخفیف', formatAdminToman(order.discountTotalToman)],
            ['ارسال', formatAdminToman(order.shippingTotalToman)],
            ['مالیات', formatAdminToman(order.taxTotalToman)],
            ['مبلغ نهایی', formatAdminToman(order.grandTotalToman)],
          ]}
        />
      </Card>

      <Card title="مشتری و آدرس تحویل">
        <DetailRows
          rows={[
            ['نام مشتری', order.customer.name ?? 'ثبت نشده'],
            ['شماره همراه', formatAdminPhone(order.customer.phone)],
            ['تحویل‌گیرنده', order.address?.recipientName ?? 'ثبت نشده'],
            ['تلفن تحویل', order.address ? formatAdminPhone(order.address.phone) : 'ثبت نشده'],
            [
              'استان و شهر',
              order.address ? `${order.address.province}، ${order.address.city}` : 'ثبت نشده',
            ],
            ['کد پستی', order.address?.postalCode ?? 'ثبت نشده'],
            ['نشانی', order.address?.addressLine ?? 'ثبت نشده'],
          ]}
        />
      </Card>

      {order.customerNote ? (
        <Card title="توضیحات مشتری" description="یادداشت ثبت‌شده هنگام نهایی‌کردن سفارش">
          <p className="whitespace-pre-wrap text-sm leading-7 text-[var(--admin-color-muted)]">
            {toPersianDigits(order.customerNote)}
          </p>
        </Card>
      ) : null}

      <Card
        title={`اقلام سفارش (${formatAdminInteger(orderItemCount(order))})`}
        description={`${formatAdminInteger(order.items.length)} ردیف کالا`}
      >
        <div className="space-y-2">
          {order.items.map((item) => (
            <OrderItemCard key={item.id} item={item} />
          ))}
        </div>
      </Card>

      <Card title="پرداخت" description="وضعیت مالی و آخرین تلاش‌های پرداخت">
        {order.payment ? (
          <div className="space-y-4">
            <DetailRows
              rows={[
                ['وضعیت', paymentStatusPresentation[order.payment.status].label],
                ['شیوه پرداخت', paymentMethodLabel(latestAttempt?.provider)],
                ['مبلغ پرداخت', formatAdminToman(order.payment.amountToman)],
                ['مبلغ بازپرداخت', formatAdminToman(order.payment.refundedAmountToman)],
                [
                  'زمان پرداخت',
                  order.payment.paidAt ? formatAdminDateTime(order.payment.paidAt) : 'ثبت نشده',
                ],
                [
                  'ارائه‌دهنده',
                  latestAttempt ? paymentProviderLabel(latestAttempt.provider) : 'ثبت نشده',
                ],
                ['مرجع پرداخت', latestAttempt?.providerReference ?? 'ثبت نشده'],
              ]}
            />
            {order.payment.attempts.length ? (
              <div>
                <h4 className="text-xs font-bold text-[var(--admin-color-muted)]">تلاش‌های اخیر</h4>
                <ol className="mt-2 space-y-2">
                  {order.payment.attempts.map((attempt) => (
                    <li
                      key={attempt.id}
                      className="rounded-lg bg-[var(--admin-color-surface-subtle)] p-3 text-xs"
                    >
                      <div className="flex justify-between gap-3">
                        <span className="font-bold">
                          {toPersianDigits(paymentProviderLabel(attempt.provider))}
                        </span>
                        <span>{attemptStatusPresentation[attempt.status]}</span>
                      </div>
                      <p className="mt-1 text-[var(--admin-color-muted)]">
                        {formatAdminDateTime(attempt.createdAt)} ·{' '}
                        {formatAdminToman(attempt.amountToman)}
                      </p>
                      {attempt.failureMessage ? (
                        <p className="mt-2 text-[var(--admin-color-danger)]">
                          {toPersianDigits(attempt.failureMessage)}
                        </p>
                      ) : null}
                      {attempt.receiptUploadedAt ? (
                        <PaymentReceiptReview attempt={attempt} canConfirm={canUpdateStatus} />
                      ) : null}
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
          </div>
        ) : (
          <Alert tone="warning">برای این سفارش هنوز رکورد پرداخت ایجاد نشده است.</Alert>
        )}
      </Card>

      <Card title="ارسال" description="سرویس، رهگیری و وضعیت مرسوله">
        {order.shipment ? (
          <DetailRows
            rows={[
              ['وضعیت', shipmentStatusPresentation[order.shipment.status]],
              ['ارائه‌دهنده', order.shipment.provider],
              ['سرویس', order.shipment.serviceName ?? 'ثبت نشده'],
              ['هزینه ارسال', formatAdminToman(order.shipment.shippingCostToman)],
              ['کد رهگیری', order.shipment.trackingCode ?? 'ثبت نشده'],
              [
                'زمان ارسال',
                order.shipment.shippedAt
                  ? formatAdminDateTime(order.shipment.shippedAt)
                  : 'ثبت نشده',
              ],
              [
                'زمان تحویل',
                order.shipment.deliveredAt
                  ? formatAdminDateTime(order.shipment.deliveredAt)
                  : 'ثبت نشده',
              ],
            ]}
          />
        ) : (
          <Alert tone="neutral">مرسوله هنوز ساخته نشده است.</Alert>
        )}
      </Card>

      <Card title="تاریخچه وضعیت" description="روند ثبت‌شده سفارش">
        {order.timeline.length ? (
          <ol className="relative space-y-0 before:absolute before:inset-y-3 before:start-[0.3125rem] before:w-px before:bg-[var(--admin-color-border)]">
            {order.timeline.map((entry, index) => (
              <li key={entry.id} className="relative pb-4 ps-6 last:pb-0">
                <span
                  aria-hidden="true"
                  className="absolute start-0 top-1.5 size-2.5 rounded-full border-2 border-white bg-[var(--admin-color-primary)] ring-1 ring-[var(--admin-color-border)]"
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-bold">{timelineStatusLabel(order, entry, index)}</p>
                  <time className="text-xs text-[var(--admin-color-subtle)]">
                    {formatAdminDateTime(entry.createdAt)}
                  </time>
                </div>
                <p className="mt-1 text-xs leading-5 text-[var(--admin-color-muted)]">
                  {toPersianDigits(entry.actor)}
                  {entry.reason ? ` · ${toPersianDigits(entry.reason)}` : ''}
                </p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-[var(--admin-color-muted)]">تاریخچه‌ای ثبت نشده است.</p>
        )}
      </Card>
    </div>
  );
}

function OrderDetailsSheet({
  order,
  canUpdateStatus,
  canCancel,
  triggerLabel = 'مشاهده',
  defaultOpen = false,
}: Readonly<{
  order: AdminOrder;
  canUpdateStatus: boolean;
  canCancel: boolean;
  triggerLabel?: string;
  defaultOpen?: boolean;
}>) {
  return (
    <BottomSheet defaultOpen={defaultOpen}>
      <BottomSheetTrigger asChild>
        <Button variant="outline" size="sm">
          {triggerLabel}
        </Button>
      </BottomSheetTrigger>
      <BottomSheetContent
        title={`سفارش ${toPersianDigits(order.orderNumber)}`}
        description={`ثبت‌شده در ${formatAdminDateTime(order.createdAt)}`}
        height="full"
      >
        <OrderDetails order={order} canUpdateStatus={canUpdateStatus} canCancel={canCancel} />
      </BottomSheetContent>
    </BottomSheet>
  );
}

function OrderMobileCard({
  order,
  canUpdateStatus,
  canCancel,
}: Readonly<{
  order: AdminOrder;
  canUpdateStatus: boolean;
  canCancel: boolean;
}>) {
  return (
    <MobileDataCard
      eyebrow={toPersianDigits(order.orderNumber)}
      title={order.customer.name ?? formatAdminPhone(order.customer.phone)}
      status={<OrderStatusBadge order={order} />}
      className={orderRequiresAttention(order) ? 'border-red-200' : undefined}
      items={[
        { label: 'مبلغ', value: formatAdminToman(order.grandTotalToman) },
        {
          label: 'پرداخت',
          value: order.payment ? paymentStatusPresentation[order.payment.status].label : 'ثبت نشده',
        },
        { label: 'تعداد کالا', value: formatAdminInteger(orderItemCount(order)) },
        { label: 'زمان ثبت', value: formatAdminDateTime(order.createdAt) },
      ]}
      detailsTitle={`سفارش ${toPersianDigits(order.orderNumber)}`}
      detailsDescription={`مشتری: ${order.customer.name ?? formatAdminPhone(order.customer.phone)}`}
      details={
        <OrderDetails order={order} canUpdateStatus={canUpdateStatus} canCancel={canCancel} />
      }
    />
  );
}

export function OrderManagementView({
  orders,
  failed,
  canUpdateStatus = false,
  canCancel = false,
  initialOrderId,
}: OrderManagementViewProps) {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [attentionFilter, setAttentionFilter] = useState('all');

  const activeCount = orders.filter((order) =>
    ['PENDING_PAYMENT', 'PAID', 'PROCESSING', 'SHIPPED'].includes(order.status),
  ).length;
  const deliveredCount = orders.filter((order) => order.status === 'DELIVERED').length;
  const closedCount = orders.filter((order) =>
    ['CANCELLED', 'EXPIRED'].includes(order.status),
  ).length;
  const paidRevenue = orders
    .filter((order) => ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'].includes(order.status))
    .reduce((total, order) => total + order.grandTotalToman, 0);
  const attentionCount = orders.filter(orderRequiresAttention).length;

  const filteredOrders = useMemo(() => {
    const normalizedQuery = toAsciiDigits(query.trim()).toLocaleLowerCase('fa');
    return orders.filter((order) => {
      const haystack = [
        order.orderNumber,
        order.customer.name,
        order.customer.phone,
        order.address?.recipientName,
        order.address?.phone,
        order.address?.postalCode,
        order.items.map((item) => `${item.productName} ${item.sku}`).join(' '),
      ]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('fa');
      const matchesPayment =
        paymentFilter === 'all' ||
        (paymentFilter === 'NONE'
          ? order.payment === null
          : order.payment?.status === paymentFilter);
      return (
        (!normalizedQuery || haystack.includes(normalizedQuery)) &&
        (statusFilter === 'all' || order.status === statusFilter) &&
        matchesPayment &&
        (attentionFilter === 'all' || orderRequiresAttention(order))
      );
    });
  }, [attentionFilter, orders, paymentFilter, query, statusFilter]);

  const columns: readonly DataTableColumn<AdminOrder>[] = [
    {
      id: 'order',
      header: 'سفارش',
      cell: (order) => (
        <div>
          <p className="font-black">{toPersianDigits(order.orderNumber)}</p>
          <p className="mt-1 text-xs text-[var(--admin-color-muted)]">
            {formatAdminDateTime(order.createdAt)}
          </p>
        </div>
      ),
    },
    {
      id: 'customer',
      header: 'مشتری',
      cell: (order) => (
        <div>
          <p className="font-semibold">{order.customer.name ?? 'بدون نام'}</p>
          <p className="mt-1 text-xs text-[var(--admin-color-muted)]">
            {formatAdminPhone(order.customer.phone)}
          </p>
        </div>
      ),
    },
    {
      id: 'status',
      header: 'وضعیت سفارش',
      cell: (order) => <OrderStatusBadge order={order} />,
    },
    { id: 'payment', header: 'پرداخت', cell: (order) => <PaymentStatusBadge order={order} /> },
    {
      id: 'items',
      header: 'اقلام',
      align: 'center',
      cell: (order) => `${formatAdminInteger(orderItemCount(order))} عدد`,
    },
    {
      id: 'amount',
      header: 'مبلغ نهایی',
      align: 'center',
      cell: (order) => <strong>{formatAdminToman(order.grandTotalToman)}</strong>,
    },
    {
      id: 'action',
      header: 'عملیات',
      align: 'end',
      cell: (order) => (
        <OrderDetailsSheet
          order={order}
          canUpdateStatus={canUpdateStatus}
          canCancel={canCancel}
          defaultOpen={order.id === initialOrderId}
        />
      ),
    },
  ];

  if (failed)
    return (
      <div className="mt-6">
        <Alert tone="danger" title="دریافت سفارش‌ها ناموفق بود">
          اطلاعات سفارش‌ها از سرور دریافت نشد.
        </Alert>
      </div>
    );

  return (
    <div className="mt-6 space-y-6">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_23rem]">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Card>
            <p className="text-xs text-[var(--admin-color-muted)]">سفارش فعال</p>
            <p className="mt-2 text-2xl font-black text-[var(--admin-color-info)]">
              {formatAdminInteger(activeCount)}
            </p>
            <p className="mt-1 text-[0.6875rem] text-[var(--admin-color-subtle)]">
              در {formatAdminInteger(orders.length)} سفارش اخیر
            </p>
          </Card>
          <Card>
            <p className="text-xs text-[var(--admin-color-muted)]">تحویل‌شده</p>
            <p className="mt-2 text-2xl font-black text-[var(--admin-color-success)]">
              {formatAdminInteger(deliveredCount)}
            </p>
            <p className="mt-1 text-[0.6875rem] text-[var(--admin-color-subtle)]">
              عملیات کامل‌شده
            </p>
          </Card>
          <Card className={attentionCount ? 'border-red-200' : undefined}>
            <p className="text-xs text-[var(--admin-color-muted)]">نیازمند بررسی</p>
            <p className="mt-2 text-2xl font-black text-[var(--admin-color-danger)]">
              {formatAdminInteger(attentionCount)}
            </p>
            <p className="mt-1 text-[0.6875rem] text-[var(--admin-color-subtle)]">
              پرداخت یا ارسال غیرعادی
            </p>
          </Card>
          <Card>
            <p className="text-xs text-[var(--admin-color-muted)]">ارزش سفارش‌های موفق</p>
            <p className="mt-2 text-lg font-black">{formatAdminToman(paidRevenue)}</p>
            <p className="mt-1 text-[0.6875rem] text-[var(--admin-color-subtle)]">در فهرست فعلی</p>
          </Card>
        </div>
        <Card title="وضعیت سفارش‌ها" description="توزیع فهرست فعلی">
          <DonutChart
            title="توزیع وضعیت سفارش‌ها"
            centerLabel="سفارش"
            segments={[
              { label: 'فعال', value: activeCount, color: 'var(--admin-color-info)' },
              { label: 'تحویل‌شده', value: deliveredCount, color: 'var(--admin-color-success)' },
              { label: 'بسته‌شده', value: closedCount, color: 'var(--admin-color-muted)' },
            ]}
          />
        </Card>
      </div>

      <section aria-labelledby="orders-list-heading" className="space-y-4">
        <div>
          <h2 id="orders-list-heading" className="text-lg font-black">
            فهرست سفارش‌ها
          </h2>
          <p className="mt-1 text-xs text-[var(--admin-color-muted)]">
            جستجو، فیلتر و مشاهده کامل اطلاعات هر سفارش
          </p>
        </div>
        <FilterBar
          activeCount={
            [
              query.trim(),
              statusFilter === 'all' ? '' : statusFilter,
              paymentFilter === 'all' ? '' : paymentFilter,
              attentionFilter === 'all' ? '' : attentionFilter,
            ].filter(Boolean).length
          }
          resetAction={
            query.trim() ||
            statusFilter !== 'all' ||
            paymentFilter !== 'all' ||
            attentionFilter !== 'all' ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setQuery('');
                  setStatusFilter('all');
                  setPaymentFilter('all');
                  setAttentionFilter('all');
                }}
              >
                پاک‌کردن فیلترها
              </Button>
            ) : undefined
          }
        >
          <SearchField
            value={query}
            onChange={(event) => setQuery(toPersianDigits(event.target.value))}
            placeholder="شماره سفارش، مشتری، موبایل یا کالا"
            aria-label="جستجوی سفارش"
          />
          <Select
            value={statusFilter}
            onValueChange={setStatusFilter}
            aria-label="فیلتر وضعیت سفارش"
            options={[
              { value: 'all', label: 'همه وضعیت‌های سفارش' },
              ...Object.entries(orderStatusPresentation).map(([value, item]) => ({
                value,
                label: item.label,
              })),
            ]}
          />
          <Select
            value={paymentFilter}
            onValueChange={setPaymentFilter}
            aria-label="فیلتر وضعیت پرداخت"
            options={[
              { value: 'all', label: 'همه وضعیت‌های پرداخت' },
              { value: 'NONE', label: 'بدون رکورد پرداخت' },
              ...Object.entries(paymentStatusPresentation).map(([value, item]) => ({
                value,
                label: item.label,
              })),
            ]}
          />
          <Select
            value={attentionFilter}
            onValueChange={setAttentionFilter}
            aria-label="فیلتر نیازمند بررسی"
            options={[
              { value: 'all', label: 'همه سفارش‌ها' },
              { value: 'attention', label: 'فقط نیازمند بررسی' },
            ]}
          />
        </FilterBar>
        <ResponsiveDataView
          mobileLabel="کارت‌های سفارش"
          renderMobileCard={(order) => (
            <OrderMobileCard
              order={order}
              canUpdateStatus={canUpdateStatus}
              canCancel={canCancel}
            />
          )}
          caption="جدول سفارش‌ها"
          columns={columns}
          rows={filteredOrders}
          getRowKey={(order) => order.id}
          stickyHeader
          emptyTitle="سفارشی با این فیلتر پیدا نشد"
          emptyDescription="فیلترها را تغییر دهید یا عبارت دیگری جستجو کنید."
          getRowClassName={(order) => (orderRequiresAttention(order) ? 'bg-red-50/40' : undefined)}
        />
      </section>
    </div>
  );
}
