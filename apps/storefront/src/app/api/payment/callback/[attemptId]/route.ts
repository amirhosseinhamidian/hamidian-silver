import { handleGenericPaymentCallback } from '@/lib/payments/payment-callback-bff';

type RouteContext = Readonly<{ params: Promise<{ attemptId: string }> }>;

export async function GET(request: Request, { params }: RouteContext): Promise<Response> {
  return handleGenericPaymentCallback(request, (await params).attemptId);
}
