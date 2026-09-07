import 'server-only';

import { cookies } from 'next/headers';

import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';
import { requestAdminCatalog, readJsonResponse } from '@/lib/catalog/catalog-api';
import { parseAdminOrders, type AdminOrder } from '@/lib/orders/orders-model';

export type OrderManagementData = Readonly<{
  orders: readonly AdminOrder[];
  failed: boolean;
}>;

export async function loadOrderManagement(): Promise<OrderManagementData> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) throw new Error('Authenticated admin session is required.');
  try {
    const response = await requestAdminCatalog('/api/v1/orders?limit=100', token);
    if (!response.ok) return { orders: [], failed: true };
    const orders = parseAdminOrders(await readJsonResponse(response));
    return { orders: orders ?? [], failed: orders === null };
  } catch {
    return { orders: [], failed: true };
  }
}
