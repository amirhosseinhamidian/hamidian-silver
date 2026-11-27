import {
  CatalogSuggestionsBusyError,
  getPublicCatalogProductSuggestions,
} from '@/lib/catalog/public-catalog';
import { normalizeCatalogSearchText } from '@/lib/catalog/search-normalization';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const query = normalizeCatalogSearchText(new URL(request.url).searchParams.get('q') ?? '');
  const headers = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' };

  if (query.length < 2 || query.length > 100 || !/[\p{L}\p{N}]/u.test(query)) {
    return Response.json({ items: [], categories: [], brands: [] }, { headers });
  }

  try {
    const suggestions = await getPublicCatalogProductSuggestions(query, 8, request.signal);
    return Response.json(suggestions, { headers });
  } catch (error) {
    if (error instanceof CatalogSuggestionsBusyError) {
      return Response.json(
        { message: 'جست‌وجو موقتاً شلوغ است.' },
        { status: 429, headers: { ...headers, 'Retry-After': '2' } },
      );
    }
    return Response.json(
      { message: 'دریافت پیشنهادهای جست‌وجو انجام نشد.' },
      { status: 502, headers },
    );
  }
}
