import { forwardCatalogUpload } from '@/lib/catalog/catalog-bff';

export async function POST(request: Request) {
  return forwardCatalogUpload(request, '/api/v1/catalog/media');
}
