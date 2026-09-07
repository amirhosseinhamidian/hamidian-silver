import { forwardCatalogMutation } from '@/lib/catalog/catalog-bff';

type CountryRouteContext = Readonly<{ params: Promise<{ countryId: string }> }>;

function countryPath(countryId: string): string {
  return `/api/v1/catalog/countries/${encodeURIComponent(countryId)}`;
}

export async function PATCH(request: Request, { params }: CountryRouteContext) {
  const { countryId } = await params;
  return forwardCatalogMutation(request, countryPath(countryId), 'PATCH');
}

export async function DELETE(request: Request, { params }: CountryRouteContext) {
  const { countryId } = await params;
  return forwardCatalogMutation(request, countryPath(countryId), 'DELETE');
}
