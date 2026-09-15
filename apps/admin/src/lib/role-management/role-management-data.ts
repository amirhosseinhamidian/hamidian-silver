import 'server-only';
import { cookies } from 'next/headers';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';
import { requestAdminCatalog, readJsonResponse } from '@/lib/catalog/catalog-api';
import { parseRoleManagementSnapshot, type RoleManagementSnapshot } from './role-management-model';

export type RoleManagementData = Readonly<{ snapshot: RoleManagementSnapshot; failed: boolean }>;
const EMPTY: RoleManagementSnapshot = { roles: [], permissions: [] };
export async function loadRoleManagement(): Promise<RoleManagementData> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) throw new Error('Authenticated admin session is required.');
  try {
    const response = await requestAdminCatalog('/api/v1/admin-roles', token);
    if (!response.ok) return { snapshot: EMPTY, failed: true };
    const snapshot = parseRoleManagementSnapshot(await readJsonResponse(response));
    return snapshot ? { snapshot, failed: false } : { snapshot: EMPTY, failed: true };
  } catch {
    return { snapshot: EMPTY, failed: true };
  }
}
