import { forwardNotificationOutboxMutation } from '@/lib/notification-outbox/notification-outbox-bff';
type RouteContext = Readonly<{
  params: Promise<{ source: string; eventId: string; action: string }>;
}>;
export async function PATCH(request: Request, { params }: RouteContext) {
  const { source, eventId, action } = await params;
  return forwardNotificationOutboxMutation(request, source, eventId, action);
}
