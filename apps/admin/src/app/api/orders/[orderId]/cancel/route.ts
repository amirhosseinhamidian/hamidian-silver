import { forwardOrderMutation } from '@/lib/orders/orders-bff';

type OrderCancellationRouteContext = Readonly<{ params: Promise<{ orderId: string }> }>;

export async function POST(request: Request, { params }: OrderCancellationRouteContext) {
  const { orderId } = await params;
  return forwardOrderMutation(
    request,
    `/api/v1/orders/${encodeURIComponent(orderId)}/cancel`,
    'POST',
  );
}
