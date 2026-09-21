import 'server-only';

import { cookies } from 'next/headers';

import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';
import { requestAdminCatalog, readJsonResponse } from '@/lib/catalog/catalog-api';
import {
  parseOrderNotificationRecipientsSnapshot,
  type OrderNotificationRecipientsSnapshot,
} from './order-notification-recipients-model';

const EMPTY: OrderNotificationRecipientsSnapshot = {
  telegramConfigured: false,
  baleConfigured: false,
  recipients: [],
};

export async function loadOrderNotificationRecipients() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) throw new Error('Authenticated manager session is required.');
  try {
    const response = await requestAdminCatalog(
      '/api/v1/admin-order-notification-recipients',
      token,
    );
    if (!response.ok) return { snapshot: EMPTY, failed: true };
    const snapshot = parseOrderNotificationRecipientsSnapshot(await readJsonResponse(response));
    return snapshot ? { snapshot, failed: false } : { snapshot: EMPTY, failed: true };
  } catch {
    return { snapshot: EMPTY, failed: true };
  }
}
