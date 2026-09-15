import { forwardPaymentGatewayUpdate } from '@/lib/payment-gateways/payment-gateway-bff';

type RouteContext = Readonly<{ params: Promise<{ provider: string }> }>;

export async function PATCH(request: Request, { params }: RouteContext) {
  const { provider } = await params;
  return forwardPaymentGatewayUpdate(request, provider);
}
