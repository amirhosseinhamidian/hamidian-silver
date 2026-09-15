import 'server-only';

import { cookies } from 'next/headers';

import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';
import { requestAdminCatalog, readJsonResponse } from '@/lib/catalog/catalog-api';
import {
  parseFulfillmentQueue,
  parseFulfillmentSummary,
  type AdminFulfillmentQueue,
  type AdminFulfillmentSummary,
} from '@/lib/fulfillment/fulfillment-model';

export type FulfillmentManagementData = Readonly<{
  queue: AdminFulfillmentQueue | null;
  summary: AdminFulfillmentSummary | null;
  failed: boolean;
}>;

export async function loadFulfillmentManagement(): Promise<FulfillmentManagementData> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) throw new Error('Authenticated admin session is required.');
  try {
    const [queueResponse, summaryResponse] = await Promise.all([
      requestAdminCatalog('/api/v1/operations/work-queue?limit=200', token),
      requestAdminCatalog('/api/v1/operations/work-queue/summary', token),
    ]);
    const [queue, summary] = await Promise.all([
      queueResponse.ok
        ? readJsonResponse(queueResponse).then(parseFulfillmentQueue)
        : Promise.resolve(null),
      summaryResponse.ok
        ? readJsonResponse(summaryResponse).then(parseFulfillmentSummary)
        : Promise.resolve(null),
    ]);
    return { queue, summary, failed: queue === null || summary === null };
  } catch {
    return { queue: null, summary: null, failed: true };
  }
}
