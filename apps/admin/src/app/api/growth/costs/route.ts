import { forwardCatalogMutation } from '@/lib/catalog/catalog-bff';

export async function POST(request: Request): Promise<Response> {
  return forwardCatalogMutation(request, '/api/v1/growth-attribution/dashboard/costs', 'POST');
}
