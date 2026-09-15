import { forwardShippingMutation } from '@/lib/shipping/shipping-bff';

type RouteContext = Readonly<{ params: Promise<{ orderId: string }> }>;

export async function PATCH(request: Request, { params }: RouteContext) {
  const { orderId } = await params;
  return forwardShippingMutation(
    request,
    `/api/v1/shipping/orders/${encodeURIComponent(orderId)}/status`,
    'PATCH',
  );
}
