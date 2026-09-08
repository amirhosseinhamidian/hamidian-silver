import { forwardIncidentRequest } from '@/lib/incidents/incidents-bff';

const ALLOWED_ACTIONS = new Set(['acknowledge', 'assign', 'unassign', 'notes']);
type RouteContext = Readonly<{ params: Promise<{ incidentId: string; action: string }> }>;

export async function POST(request: Request, { params }: RouteContext) {
  const { incidentId, action } = await params;
  if (!ALLOWED_ACTIONS.has(action)) {
    return Response.json({ message: 'Unsupported incident action.' }, { status: 404 });
  }
  return forwardIncidentRequest(
    request,
    `/api/v1/operations/incidents/${encodeURIComponent(incidentId)}/${action}`,
    'POST',
  );
}
