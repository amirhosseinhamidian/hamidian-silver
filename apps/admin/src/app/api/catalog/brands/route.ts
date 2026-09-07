import { forwardCatalogMutation } from '@/lib/catalog/catalog-bff';

export async function POST(request: Request) {
  return forwardCatalogMutation(request, '/api/v1/catalog/brands', 'POST');
}
