import { forwardOperationalAlertMutation } from '@/lib/operational-alerts/operational-alerts-bff';

type RouteContext = Readonly<{ params: Promise<{ incidentId: string }> }>;

export async function POST(request: Request, { params }: RouteContext) {
  const { incidentId } = await params;
  return forwardOperationalAlertMutation(
    request,
    `/api/v1/operations/incidents/${encodeURIComponent(incidentId)}/acknowledge`,
  );
}
