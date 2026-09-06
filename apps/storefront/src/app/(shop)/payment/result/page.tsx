import type { CustomerOrderDetail } from '@/components/account/account-types';
import { toPersianDigits } from '@/components/account/account-types';
import { PaymentResult, type PaymentResultStatus } from '@/components/checkout/payment-result';
import { getCustomerOrder } from '@/lib/orders/customer-orders-bff';

export const metadata = {
  title: 'نتیجه پرداخت',
  robots: { index: false, follow: false },
};

type PaymentResultPageProps = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function callbackStatus(value: string | undefined): PaymentResultStatus {
  return value === 'success' || value === 'failed' ? value : 'pending';
}

function verifiedResultStatus(
  fallback: PaymentResultStatus,
  orderStatus?: string,
): PaymentResultStatus {
  if (['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'].includes(orderStatus ?? '')) return 'success';
  if (orderStatus === 'CANCELLED' || orderStatus === 'EXPIRED') return 'failed';
  return fallback === 'failed' ? 'failed' : 'pending';
}

export default async function PaymentResultPage({ searchParams }: PaymentResultPageProps) {
  const query = await searchParams;
  const requestedStatus = callbackStatus(firstValue(query.status));
  const orderId = firstValue(query.orderId);
  let order: CustomerOrderDetail | null = null;

  if (orderId) {
    try {
      const response = await getCustomerOrder(orderId);
      if (response.ok) order = (await response.json()) as CustomerOrderDetail;
    } catch {
      // The callback result remains deliberately unconfirmed when order verification is unavailable.
    }
  }

  return (
    <PaymentResult
      status={verifiedResultStatus(requestedStatus, order?.status)}
      orderId={orderId}
      orderNumber={order ? toPersianDigits(order.orderNumber) : undefined}
    />
  );
}
