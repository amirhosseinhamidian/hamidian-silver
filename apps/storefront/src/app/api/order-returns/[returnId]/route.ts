import { cancelCustomerOrderReturn } from '@/lib/orders/customer-order-returns-bff';

type RouteContext = Readonly<{ params: Promise<{ returnId: string }> }>;

export async function DELETE(_request: Request, { params }: RouteContext): Promise<Response> {
  return cancelCustomerOrderReturn((await params).returnId);
}
