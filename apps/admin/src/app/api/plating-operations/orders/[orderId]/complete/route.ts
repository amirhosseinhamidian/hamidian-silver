import { forwardPlatingOperation } from '@/lib/plating-operations/plating-operations-bff';

type RouteContext = Readonly<{ params: Promise<{ orderId: string }> }>;

export async function POST(request: Request, { params }: RouteContext) {
  const { orderId } = await params;
  return forwardPlatingOperation(
    request,
    `/api/v1/operations/plating/orders/${encodeURIComponent(orderId)}/complete`,
  );
}
