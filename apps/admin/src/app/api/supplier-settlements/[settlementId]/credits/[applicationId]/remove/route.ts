import { forwardSupplierSettlement } from '@/lib/supplier-settlements/supplier-settlements-bff';

type RouteContext = Readonly<{
  params: Promise<{ settlementId: string; applicationId: string }>;
}>;

export async function POST(request: Request, { params }: RouteContext) {
  const { settlementId, applicationId } = await params;
  return forwardSupplierSettlement(
    request,
    `/api/v1/finance/supplier-settlements/${encodeURIComponent(settlementId)}/credits/${encodeURIComponent(applicationId)}/remove`,
    'POST',
  );
}
