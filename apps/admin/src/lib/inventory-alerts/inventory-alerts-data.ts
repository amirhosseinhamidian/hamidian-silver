import 'server-only';

import { cookies } from 'next/headers';

import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';
import { requestAdminCatalog, readJsonResponse } from '@/lib/catalog/catalog-api';
import {
  parseStockNotificationSummary,
  type AdminStockNotificationSummary,
} from '@/lib/inventory-alerts/inventory-alerts-model';
import {
  loadInventoryManagement,
  type InventoryManagementData,
} from '@/lib/inventory/inventory-data';

export type InventoryAlertsData = Readonly<{
  inventory: InventoryManagementData;
  notifications: AdminStockNotificationSummary | null;
  notificationsFailed: boolean;
}>;

async function loadNotificationSummary(): Promise<{
  data: AdminStockNotificationSummary | null;
  failed: boolean;
}> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) throw new Error('Authenticated admin session is required.');
  try {
    const response = await requestAdminCatalog('/api/v1/stock-notifications/admin/summary', token);
    if (!response.ok) return { data: null, failed: true };
    const data = parseStockNotificationSummary(await readJsonResponse(response));
    return { data, failed: data === null };
  } catch {
    return { data: null, failed: true };
  }
}

export async function loadInventoryAlerts(warehouseId?: string): Promise<InventoryAlertsData> {
  const [inventory, notifications] = await Promise.all([
    loadInventoryManagement(warehouseId),
    loadNotificationSummary(),
  ]);
  return {
    inventory,
    notifications: notifications.data,
    notificationsFailed: notifications.failed,
  };
}
