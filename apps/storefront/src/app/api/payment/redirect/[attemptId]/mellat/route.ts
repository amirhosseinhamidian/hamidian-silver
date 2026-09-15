import { proxyMellatPaymentRedirect } from '@/lib/payments/payment-callback-bff';

type RouteContext = Readonly<{ params: Promise<{ attemptId: string }> }>;

export async function GET(_request: Request, { params }: RouteContext): Promise<Response> {
  return proxyMellatPaymentRedirect((await params).attemptId);
}
