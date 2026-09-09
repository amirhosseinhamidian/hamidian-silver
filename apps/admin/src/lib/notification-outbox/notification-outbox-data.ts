import 'server-only';
import { cookies } from 'next/headers';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';
import { requestAdminCatalog, readJsonResponse } from '@/lib/catalog/catalog-api';
import {
  parseNotificationOutboxSnapshot,
  type NotificationOutboxSnapshot,
} from './notification-outbox-model';

export type NotificationOutboxData = Readonly<{
  snapshot: NotificationOutboxSnapshot | null;
  failed: boolean;
}>;
export async function loadNotificationOutbox(): Promise<NotificationOutboxData> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) throw new Error('Authenticated admin session is required.');
  try {
    const response = await requestAdminCatalog(
      '/api/v1/notifications/recovery/outbox?limit=200',
      token,
    );
    if (!response.ok) return { snapshot: null, failed: true };
    const snapshot = parseNotificationOutboxSnapshot(await readJsonResponse(response));
    return { snapshot, failed: snapshot === null };
  } catch {
    return { snapshot: null, failed: true };
  }
}
