import { forwardCatalogMutation } from '@/lib/catalog/catalog-bff';

export function POST(request: Request) {
  return forwardCatalogMutation(request, '/api/v1/catalog/attribute-definitions', 'POST');
}
