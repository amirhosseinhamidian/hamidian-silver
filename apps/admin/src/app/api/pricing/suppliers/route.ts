import { forwardSupplierMutation } from '@/lib/suppliers/suppliers-bff';

export async function POST(request: Request) {
  return forwardSupplierMutation(request, '/api/v1/pricing/suppliers', 'POST');
}
