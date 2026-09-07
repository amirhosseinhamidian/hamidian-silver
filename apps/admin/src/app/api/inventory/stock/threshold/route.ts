import { forwardInventoryMutation } from '@/lib/inventory/inventory-bff';

export async function PATCH(request: Request) {
  return forwardInventoryMutation(request, '/api/v1/inventory/stock/low-stock-threshold', 'PATCH');
}
