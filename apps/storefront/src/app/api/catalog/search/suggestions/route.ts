import { getPublicCatalogProductSuggestions } from '@/lib/catalog/public-catalog';
import { normalizeCatalogSearchText } from '@/lib/catalog/search-normalization';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const query = normalizeCatalogSearchText(new URL(request.url).searchParams.get('q') ?? '');

  if (query.length < 2 || query.length > 100) {
    return Response.json({ items: [] });
  }

  try {
    const suggestions = await getPublicCatalogProductSuggestions(query, 8);
    return Response.json(suggestions);
  } catch {
    return Response.json({ message: 'دریافت پیشنهادهای جست‌وجو انجام نشد.' }, { status: 502 });
  }
}
