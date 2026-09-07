import { forwardOrderMutation } from '@/lib/orders/orders-bff';

type ReturnAuthorizationRouteContext = Readonly<{ params: Promise<{ orderId: string }> }>;

export async function POST(request: Request, { params }: ReturnAuthorizationRouteContext) {
  const { orderId } = await params;
  return forwardOrderMutation(
    request,
    `/api/v1/orders/${encodeURIComponent(orderId)}/return-authorization`,
    'POST',
  );
}
