import { forwardPaymentOperation } from '@/lib/payments/payment-operations-bff';

type RouteContext = Readonly<{ params: Promise<{ attemptId: string }> }>;

export async function PATCH(request: Request, { params }: RouteContext) {
  const { attemptId } = await params;
  return forwardPaymentOperation(
    request,
    `/api/v1/payments/initiation-recovery/${encodeURIComponent(attemptId)}/resolve`,
  );
}
