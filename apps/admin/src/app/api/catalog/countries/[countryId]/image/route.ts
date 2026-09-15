import { forwardCatalogMutation, forwardCatalogUpload } from '@/lib/catalog/catalog-bff';

type CountryImageRouteContext = Readonly<{ params: Promise<{ countryId: string }> }>;

function imagePath(countryId: string): string {
  return `/api/v1/catalog/countries/${encodeURIComponent(countryId)}/image`;
}

export async function POST(request: Request, { params }: CountryImageRouteContext) {
  const { countryId } = await params;
  return forwardCatalogUpload(request, imagePath(countryId));
}

export async function DELETE(request: Request, { params }: CountryImageRouteContext) {
  const { countryId } = await params;
  return forwardCatalogMutation(request, imagePath(countryId), 'DELETE');
}
