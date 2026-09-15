import { forwardSupplierSettlement } from '@/lib/supplier-settlements/supplier-settlements-bff';

const ALLOWED_ACTIONS = new Set(['pay', 'cancel']);
type RouteContext = Readonly<{ params: Promise<{ settlementId: string; action: string }> }>;

export async function POST(request: Request, { params }: RouteContext) {
  const { settlementId, action } = await params;
  if (!ALLOWED_ACTIONS.has(action)) {
    return Response.json({ message: 'Unsupported supplier settlement action.' }, { status: 404 });
  }
  return forwardSupplierSettlement(
    request,
    `/api/v1/finance/supplier-settlements/${encodeURIComponent(settlementId)}/${action}`,
    'POST',
  );
}
