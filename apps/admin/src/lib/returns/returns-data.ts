import 'server-only';

import { cookies } from 'next/headers';

import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';
import { requestAdminCatalog, readJsonResponse } from '@/lib/catalog/catalog-api';
import { parseOrderReturns, type AdminOrderReturn } from '@/lib/returns/returns-model';

export type ReturnsData = Readonly<{
  returns: readonly AdminOrderReturn[];
  failed: boolean;
}>;

export async function loadOrderReturns(): Promise<ReturnsData> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) throw new Error('Authenticated admin session is required.');
  try {
    const response = await requestAdminCatalog('/api/v1/orders/returns?limit=200', token);
    if (!response.ok) return { returns: [], failed: true };
    const returns = parseOrderReturns(await readJsonResponse(response));
    return { returns: returns ?? [], failed: returns === null };
  } catch {
    return { returns: [], failed: true };
  }
}
