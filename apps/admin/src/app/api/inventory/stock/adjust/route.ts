import { forwardInventoryMutation } from '@/lib/inventory/inventory-bff';

export async function POST(request: Request) {
  return forwardInventoryMutation(request, '/api/v1/inventory/stock/adjust', 'POST');
}
