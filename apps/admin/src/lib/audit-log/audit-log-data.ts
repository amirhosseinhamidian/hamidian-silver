import 'server-only';

import { cookies } from 'next/headers';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';
import { requestAdminCatalog, readJsonResponse } from '@/lib/catalog/catalog-api';
import { parseAuditLogSnapshot, type AuditLogSnapshot } from './audit-log-model';

export type AuditLogData = Readonly<{
  snapshot: AuditLogSnapshot | null;
  failed: boolean;
}>;

export async function loadAuditLog(): Promise<AuditLogData> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) throw new Error('Authenticated admin session is required.');

  try {
    const response = await requestAdminCatalog('/api/v1/audit-logs?limit=200', token);
    if (!response.ok) return { snapshot: null, failed: true };
    const snapshot = parseAuditLogSnapshot(await readJsonResponse(response));
    return { snapshot, failed: snapshot === null };
  } catch {
    return { snapshot: null, failed: true };
  }
}
