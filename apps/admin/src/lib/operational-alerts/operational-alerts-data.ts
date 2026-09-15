import 'server-only';

import { cookies } from 'next/headers';

import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';
import { requestAdminCatalog, readJsonResponse } from '@/lib/catalog/catalog-api';
import {
  parseOperationalAlerts,
  parseOperationalAlertSummary,
  type AdminOperationalAlert,
  type AdminOperationalAlertSummary,
} from '@/lib/operational-alerts/operational-alerts-model';

export type OperationalAlertsData = Readonly<{
  alerts: readonly AdminOperationalAlert[];
  summary: AdminOperationalAlertSummary | null;
  failed: boolean;
}>;

export async function loadOperationalAlerts(): Promise<OperationalAlertsData> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) throw new Error('Authenticated admin session is required.');
  try {
    const [openResponse, acknowledgedResponse, resolvedResponse, summaryResponse] =
      await Promise.all([
        requestAdminCatalog('/api/v1/operations/incidents?status=OPEN&limit=200', token),
        requestAdminCatalog('/api/v1/operations/incidents?status=ACKNOWLEDGED&limit=200', token),
        requestAdminCatalog('/api/v1/operations/incidents?status=RESOLVED&limit=200', token),
        requestAdminCatalog('/api/v1/operations/alerts/summary', token),
      ]);
    const [open, acknowledged, resolved, summary] = await Promise.all([
      openResponse.ok
        ? readJsonResponse(openResponse).then(parseOperationalAlerts)
        : Promise.resolve(null),
      acknowledgedResponse.ok
        ? readJsonResponse(acknowledgedResponse).then(parseOperationalAlerts)
        : Promise.resolve(null),
      resolvedResponse.ok
        ? readJsonResponse(resolvedResponse).then(parseOperationalAlerts)
        : Promise.resolve(null),
      summaryResponse.ok
        ? readJsonResponse(summaryResponse).then(parseOperationalAlertSummary)
        : Promise.resolve(null),
    ]);
    const alerts =
      open && acknowledged && resolved ? [...open, ...acknowledged, ...resolved] : null;
    return {
      alerts: alerts ?? [],
      summary,
      failed: alerts === null || summary === null,
    };
  } catch {
    return { alerts: [], summary: null, failed: true };
  }
}
