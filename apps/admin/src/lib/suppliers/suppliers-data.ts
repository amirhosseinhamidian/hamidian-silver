import 'server-only';

import { cookies } from 'next/headers';

import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';
import { requestAdminCatalog, readJsonResponse } from '@/lib/catalog/catalog-api';
import { parseSupplierCatalog, type AdminSupplierCatalog } from '@/lib/suppliers/suppliers-model';

export type SupplierManagementData = Readonly<{
  data: AdminSupplierCatalog | null;
  failed: boolean;
}>;

export async function loadSupplierManagement(): Promise<SupplierManagementData> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) throw new Error('Authenticated admin session is required.');
  try {
    const response = await requestAdminCatalog('/api/v1/pricing/suppliers/catalog', token);
    if (!response.ok) return { data: null, failed: true };
    const data = parseSupplierCatalog(await readJsonResponse(response));
    return { data, failed: data === null };
  } catch {
    return { data: null, failed: true };
  }
}
