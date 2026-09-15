import { forwardShippingCarrierMutation } from '@/lib/shipping/shipping-bff';

type RouteContext = Readonly<{ params: Promise<{ carrierId: string }> }>;

export async function PATCH(request: Request, { params }: RouteContext) {
  return forwardShippingCarrierMutation(request, (await params).carrierId);
}
