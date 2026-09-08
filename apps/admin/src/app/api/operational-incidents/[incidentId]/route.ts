import { forwardIncidentRequest } from '@/lib/incidents/incidents-bff';

type RouteContext = Readonly<{ params: Promise<{ incidentId: string }> }>;

export async function GET(request: Request, { params }: RouteContext) {
  const { incidentId } = await params;
  return forwardIncidentRequest(
    request,
    `/api/v1/operations/incidents/${encodeURIComponent(incidentId)}`,
    'GET',
  );
}
