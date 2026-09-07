import { forwardPaymentOperation } from '@/lib/payments/payment-operations-bff';

type RouteContext = Readonly<{ params: Promise<{ reconciliationId: string }> }>;

export async function PATCH(request: Request, { params }: RouteContext) {
  const { reconciliationId } = await params;
  return forwardPaymentOperation(
    request,
    `/api/v1/payments/reconciliations/${encodeURIComponent(reconciliationId)}/resolve-external-refund`,
  );
}
