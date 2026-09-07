import { forwardInventoryMutation } from '@/lib/inventory/inventory-bff';

type WarehouseRouteContext = Readonly<{ params: Promise<{ warehouseId: string }> }>;

export async function PATCH(request: Request, { params }: WarehouseRouteContext) {
  const { warehouseId } = await params;
  return forwardInventoryMutation(
    request,
    `/api/v1/inventory/warehouses/${encodeURIComponent(warehouseId)}`,
    'PATCH',
  );
}
