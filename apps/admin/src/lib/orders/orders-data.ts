import 'server-only';

import { cookies } from 'next/headers';

import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';
import { requestAdminCatalog, readJsonResponse } from '@/lib/catalog/catalog-api';
import { parseAdminOrders, type AdminOrder } from '@/lib/orders/orders-model';

export type OrderManagementData = Readonly<{
  orders: readonly AdminOrder[];
  failed: boolean;
}>;

export async function loadOrderManagement(orderId?: string): Promise<OrderManagementData> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) throw new Error('Authenticated admin session is required.');
  try {
    const query = new URLSearchParams(orderId ? { orderId, limit: '1' } : { limit: '100' });
    const response = await requestAdminCatalog(`/api/v1/orders?${query}`, token);
    if (!response.ok) return { orders: [], failed: true };
    const orders = parseAdminOrders(await readJsonResponse(response));
    return { orders: orders ?? [], failed: orders === null };
  } catch {
    return { orders: [], failed: true };
  }
}
