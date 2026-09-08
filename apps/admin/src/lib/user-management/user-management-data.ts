import 'server-only';

import { cookies } from 'next/headers';

import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';
import { requestAdminCatalog, readJsonResponse } from '@/lib/catalog/catalog-api';
import {
  parseUserManagementSnapshot,
  type UserManagementSnapshot,
} from '@/lib/user-management/user-management-model';

export type UserManagementData = Readonly<{ snapshot: UserManagementSnapshot; failed: boolean }>;

const EMPTY: UserManagementSnapshot = { users: [], roles: [] };

export async function loadUserManagement(): Promise<UserManagementData> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) throw new Error('Authenticated admin session is required.');
  try {
    const response = await requestAdminCatalog('/api/v1/admin-users?limit=200', token);
    if (!response.ok) return { snapshot: EMPTY, failed: true };
    const snapshot = parseUserManagementSnapshot(await readJsonResponse(response));
    return snapshot ? { snapshot, failed: false } : { snapshot: EMPTY, failed: true };
  } catch {
    return { snapshot: EMPTY, failed: true };
  }
}
