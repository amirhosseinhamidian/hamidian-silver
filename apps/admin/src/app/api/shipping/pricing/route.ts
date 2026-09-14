import { forwardShippingMutation } from '@/lib/shipping/shipping-bff';

export async function PUT(request: Request) {
  return forwardShippingMutation(request, '/api/v1/shipping/pricing', 'PUT');
}
