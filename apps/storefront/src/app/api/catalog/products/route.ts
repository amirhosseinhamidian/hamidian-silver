import {
  getPublicCatalogProducts,
  parseCatalogSearchParams,
  type CatalogSearchParams,
} from '@/lib/catalog/public-catalog';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const searchParams = Object.fromEntries(new URL(request.url).searchParams) as CatalogSearchParams;

  try {
    const products = await getPublicCatalogProducts(parseCatalogSearchParams(searchParams));

    return Response.json(products);
  } catch {
    return Response.json({ message: 'بارگذاری محصولات بیشتر انجام نشد.' }, { status: 502 });
  }
}
