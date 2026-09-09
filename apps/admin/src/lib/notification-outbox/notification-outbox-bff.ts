import 'server-only';
import { cookies } from 'next/headers';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';
import { requestAdminCatalog, readJsonResponse } from '@/lib/catalog/catalog-api';

export async function forwardNotificationOutboxMutation(
  request: Request,
  source: string,
  eventId: string,
  action: string,
): Promise<Response> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) return Response.json({ message: 'Authentication required.' }, { status: 401 });
  if (!['customer', 'operational'].includes(source) || !['retry', 'resolve'].includes(action))
    return Response.json({ message: 'Unsupported outbox operation.' }, { status: 400 });
  const path =
    action === 'retry'
      ? `/api/v1/notifications/recovery/outbox/${source}/${encodeURIComponent(eventId)}/retry`
      : `/api/v1/notifications/recovery/${source}/${encodeURIComponent(eventId)}/resolve`;
  try {
    const response = await requestAdminCatalog(path, token, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: await request.text(),
    });
    const payload = await readJsonResponse(response);
    if (!response.ok) return Response.json(payload ?? null, { status: response.status });
    const snapshotResponse = await requestAdminCatalog(
      '/api/v1/notifications/recovery/outbox?limit=200',
      token,
    );
    return Response.json((await readJsonResponse(snapshotResponse)) ?? null, {
      status: snapshotResponse.status,
    });
  } catch {
    return Response.json(
      { message: 'Notification outbox service is unavailable.' },
      { status: 502 },
    );
  }
}
