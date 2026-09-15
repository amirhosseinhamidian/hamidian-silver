import { forwardSupplierSettlement } from '@/lib/supplier-settlements/supplier-settlements-bff';

type RouteContext = Readonly<{ params: Promise<{ settlementId: string }> }>;

export async function GET(request: Request, { params }: RouteContext) {
  const { settlementId } = await params;
  return forwardSupplierSettlement(
    request,
    `/api/v1/finance/supplier-settlements/${encodeURIComponent(settlementId)}`,
    'GET',
  );
}
