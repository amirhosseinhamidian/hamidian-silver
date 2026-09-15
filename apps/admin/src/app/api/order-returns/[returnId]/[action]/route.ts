import { forwardReturnMutation } from '@/lib/returns/returns-bff';

const ALLOWED_ACTIONS = new Set(['receive', 'cancel']);
type RouteContext = Readonly<{ params: Promise<{ returnId: string; action: string }> }>;

export async function POST(request: Request, { params }: RouteContext) {
  const { returnId, action } = await params;
  if (!ALLOWED_ACTIONS.has(action)) {
    return Response.json({ message: 'Unsupported return action.' }, { status: 404 });
  }
  return forwardReturnMutation(
    request,
    `/api/v1/orders/returns/${encodeURIComponent(returnId)}/${action}`,
  );
}
