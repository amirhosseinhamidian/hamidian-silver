import {
  catalogSearchParamsFromEntries,
  parseCatalogFacetFilters,
} from '@/lib/catalog/catalog-filter-state';
import { getPublicFacetedCatalog } from '@/lib/catalog/public-catalog';

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const readScope = (key: string) => {
    const value = searchParams.get(key)?.trim();
    return value && value.length <= 180 && !value.includes('\0') ? value : undefined;
  };
  const headers = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' };

  try {
    const products = await getPublicFacetedCatalog(
      parseCatalogFacetFilters(catalogSearchParamsFromEntries(searchParams)),
      { category: readScope('scopeCategory'), brand: readScope('scopeBrand') },
      request.signal,
    );
    return Response.json(products, { status: products.invalidFilters ? 400 : 200, headers });
  } catch {
    return Response.json(
      { message: 'بارگذاری محصولات بیشتر انجام نشد.' },
      { status: 502, headers },
    );
  }
}
