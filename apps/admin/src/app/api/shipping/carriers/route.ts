import { forwardShippingCarrierMutation } from '@/lib/shipping/shipping-bff';

export async function POST(request: Request) {
  return forwardShippingCarrierMutation(request);
}
