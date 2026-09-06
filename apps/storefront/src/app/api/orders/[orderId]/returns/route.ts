import {
  createCustomerOrderReturn,
  listCustomerOrderReturns,
} from '@/lib/orders/customer-order-returns-bff';

type RouteContext = Readonly<{ params: Promise<{ orderId: string }> }>;

export async function GET(_request: Request, { params }: RouteContext): Promise<Response> {
  return listCustomerOrderReturns((await params).orderId);
}

export async function POST(request: Request, { params }: RouteContext): Promise<Response> {
  return createCustomerOrderReturn(request, (await params).orderId);
}
