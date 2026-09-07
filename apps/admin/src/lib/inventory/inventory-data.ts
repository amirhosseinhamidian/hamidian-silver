import 'server-only';

import { cookies } from 'next/headers';

import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';
import { requestAdminCatalog, readJsonResponse } from '@/lib/catalog/catalog-api';
import {
  parseInventoryCatalog,
  parseWarehouses,
  type AdminInventoryItem,
  type AdminWarehouse,
} from '@/lib/inventory/inventory-model';

export type InventoryManagementData = Readonly<{
  warehouses: readonly AdminWarehouse[];
  items: readonly AdminInventoryItem[];
  selectedWarehouseId: string | null;
  warehousesFailed: boolean;
  itemsFailed: boolean;
}>;

export async function loadInventoryManagement(
  requestedWarehouseId?: string,
): Promise<InventoryManagementData> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) throw new Error('Authenticated admin session is required.');

  try {
    const response = await requestAdminCatalog('/api/v1/inventory/warehouses', token);
    if (!response.ok) {
      return {
        warehouses: [],
        items: [],
        selectedWarehouseId: null,
        warehousesFailed: true,
        itemsFailed: false,
      };
    }
    const warehouses = parseWarehouses(await readJsonResponse(response));
    if (!warehouses) {
      return {
        warehouses: [],
        items: [],
        selectedWarehouseId: null,
        warehousesFailed: true,
        itemsFailed: false,
      };
    }

    const selected =
      warehouses.find((warehouse) => warehouse.id === requestedWarehouseId) ??
      warehouses.find((warehouse) => warehouse.isDefault) ??
      warehouses[0];
    if (!selected) {
      return {
        warehouses,
        items: [],
        selectedWarehouseId: null,
        warehousesFailed: false,
        itemsFailed: false,
      };
    }

    const catalogResponse = await requestAdminCatalog(
      `/api/v1/inventory/stock/catalog?warehouseId=${encodeURIComponent(selected.id)}`,
      token,
    );
    const items = catalogResponse.ok
      ? parseInventoryCatalog(await readJsonResponse(catalogResponse))
      : null;
    return {
      warehouses,
      items: items ?? [],
      selectedWarehouseId: selected.id,
      warehousesFailed: false,
      itemsFailed: items === null,
    };
  } catch {
    return {
      warehouses: [],
      items: [],
      selectedWarehouseId: null,
      warehousesFailed: true,
      itemsFailed: false,
    };
  }
}
