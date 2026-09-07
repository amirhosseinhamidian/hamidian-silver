import { forwardOrderMutation } from '@/lib/orders/orders-bff';

type OrderStatusRouteContext = Readonly<{ params: Promise<{ orderId: string }> }>;

export async function PATCH(request: Request, { params }: OrderStatusRouteContext) {
  const { orderId } = await params;
  return forwardOrderMutation(
    request,
    `/api/v1/orders/${encodeURIComponent(orderId)}/status`,
    'PATCH',
  );
}
