import { forwardSupplierSettlement } from '@/lib/supplier-settlements/supplier-settlements-bff';

export async function POST(request: Request) {
  return forwardSupplierSettlement(request, '/api/v1/finance/supplier-settlements', 'POST');
}
