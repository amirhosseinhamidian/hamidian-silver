import { getCustomerPaymentReceipt } from '@/lib/orders/customer-orders-bff';

type RouteContext = Readonly<{ params: Promise<{ orderId: string }> }>;

export async function GET(_request: Request, { params }: RouteContext): Promise<Response> {
  return getCustomerPaymentReceipt((await params).orderId);
}
