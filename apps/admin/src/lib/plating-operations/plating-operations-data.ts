import 'server-only';

import { cookies } from 'next/headers';

import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';
import { requestAdminCatalog, readJsonResponse } from '@/lib/catalog/catalog-api';
import {
  parsePlatingOperations,
  type AdminPlatingOrder,
} from '@/lib/plating-operations/plating-operations-model';

export type PlatingOperationsData = Readonly<{
  orders: readonly AdminPlatingOrder[];
  failed: boolean;
}>;

export async function loadPlatingOperations(): Promise<PlatingOperationsData> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) throw new Error('Authenticated admin session is required.');
  try {
    const response = await requestAdminCatalog(
      '/api/v1/operations/plating/orders?limit=200',
      token,
    );
    if (!response.ok) return { orders: [], failed: true };
    const orders = parsePlatingOperations(await readJsonResponse(response));
    return orders ? { orders, failed: false } : { orders: [], failed: true };
  } catch {
    return { orders: [], failed: true };
  }
}
