import { forwardSupplierImportMutation } from '@/lib/supplier-imports/supplier-imports-bff';

export async function POST(request: Request) {
  return forwardSupplierImportMutation(request, '/api/v1/supplier-imports/categories/sync', 'POST');
}
