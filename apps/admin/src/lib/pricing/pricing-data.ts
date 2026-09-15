import 'server-only';

import { cookies } from 'next/headers';

import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';
import { requestAdminCatalog, readJsonResponse } from '@/lib/catalog/catalog-api';
import { parsePricingCatalog, type AdminPricingCatalog } from '@/lib/pricing/pricing-model';

export type PricingManagementData = Readonly<{
  data: AdminPricingCatalog | null;
  failed: boolean;
}>;

export async function loadPricingManagement(): Promise<PricingManagementData> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) throw new Error('Authenticated admin session is required.');
  try {
    const response = await requestAdminCatalog('/api/v1/pricing/catalog', token);
    if (!response.ok) return { data: null, failed: true };
    const data = parsePricingCatalog(await readJsonResponse(response));
    return { data, failed: data === null };
  } catch {
    return { data: null, failed: true };
  }
}
