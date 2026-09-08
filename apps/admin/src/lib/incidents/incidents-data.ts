import 'server-only';

import { cookies } from 'next/headers';

import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';
import { requestAdminCatalog, readJsonResponse } from '@/lib/catalog/catalog-api';
import {
  parseOperationalAlerts,
  type AdminOperationalAlert,
} from '@/lib/operational-alerts/operational-alerts-model';

export type IncidentsData = Readonly<{
  incidents: readonly AdminOperationalAlert[];
  failed: boolean;
}>;

export async function loadOperationalIncidents(): Promise<IncidentsData> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) throw new Error('Authenticated admin session is required.');
  try {
    const responses = await Promise.all(
      ['OPEN', 'ACKNOWLEDGED', 'RESOLVED'].map((status) =>
        requestAdminCatalog(`/api/v1/operations/incidents?status=${status}&limit=200`, token),
      ),
    );
    const groups = await Promise.all(
      responses.map((response) =>
        response.ok
          ? readJsonResponse(response).then(parseOperationalAlerts)
          : Promise.resolve(null),
      ),
    );
    if (groups.some((group) => group === null)) return { incidents: [], failed: true };
    return {
      incidents: (groups as (readonly AdminOperationalAlert[])[]).flat(),
      failed: false,
    };
  } catch {
    return { incidents: [], failed: true };
  }
}
