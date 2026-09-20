import type { CustomerOrder, CustomerPaymentMethod } from '@/components/account/account-types';
import { toPersianDigits } from '@/components/account/account-types';

const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: 'در انتظار پرداخت',
  PAID: 'پرداخت‌شده',
  PROCESSING: 'در حال آماده‌سازی',
  SHIPPED: 'ارسال‌شده',
  DELIVERED: 'تحویل‌شده',
  CANCELLED: 'لغوشده',
  EXPIRED: 'منقضی‌شده',
};

export function orderStatusLabel(status: string): string {
  return ORDER_STATUS_LABELS[status] ?? status;
}

export function customerOrderStatusLabel(order: Pick<CustomerOrder, 'payment' | 'status'>): string {
  return order.payment?.status === 'AWAITING_REVIEW'
    ? 'در انتظار بررسی رسید'
    : orderStatusLabel(order.status);
}

export function paymentMethodLabel(method: CustomerPaymentMethod | null | undefined): string {
  if (method === 'CARD_TO_CARD') return 'کارت‌به‌کارت';
  if (method === 'PAYMENT_GATEWAY') return 'درگاه بانکی';
  return 'هنوز انتخاب نشده';
}

export function formatOrderDate(value: string, includeTime = false): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return toPersianDigits(value);

  return new Intl.DateTimeFormat('fa-IR', {
    dateStyle: 'medium',
    ...(includeTime ? { timeStyle: 'short' as const } : {}),
  }).format(date);
}
