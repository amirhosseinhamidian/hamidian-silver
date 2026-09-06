import { cancelCustomerOrder, getCustomerOrder } from '@/lib/orders/customer-orders-bff';

type RouteContext = Readonly<{ params: Promise<{ orderId: string }> }>;

export async function GET(_request: Request, { params }: RouteContext): Promise<Response> {
  return getCustomerOrder((await params).orderId);
}

export async function POST(_request: Request, { params }: RouteContext): Promise<Response> {
  return cancelCustomerOrder((await params).orderId);
}
