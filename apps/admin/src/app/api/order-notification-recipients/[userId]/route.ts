import { forwardOrderNotificationRecipientUpdate } from '@/lib/order-notifications/order-notification-recipients-bff';

type RouteContext = Readonly<{ params: Promise<{ userId: string }> }>;

export async function PUT(request: Request, { params }: RouteContext) {
  const { userId } = await params;
  return forwardOrderNotificationRecipientUpdate(request, userId);
}
