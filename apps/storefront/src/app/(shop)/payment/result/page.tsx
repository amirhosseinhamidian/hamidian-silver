import type { CustomerOrderDetail } from '@/components/account/account-types';
import { PaymentResult } from '@/components/checkout/payment-result';
import { verifiedPaymentStatus } from '@/lib/checkout/verified-payment-status';
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

export default async function PaymentResultPage({ searchParams }: PaymentResultPageProps) {
  const query = await searchParams;
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
    <PaymentResult status={verifiedPaymentStatus(order?.status)} orderId={orderId} order={order} />
  );
}
