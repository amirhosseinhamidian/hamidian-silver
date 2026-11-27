import {
  giftFinderFilters,
  parseGiftFinderRequest,
  withinGiftBudget,
  type GiftFinderResults,
} from '@/lib/catalog/gift-finder';
import { getPublicFacetedCatalog } from '@/lib/catalog/public-catalog';

const headers = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' };

export async function POST(request: Request): Promise<Response> {
  if (!request.headers.get('content-type')?.startsWith('application/json')) {
    return Response.json(null, { status: 415, headers });
  }
  const input = parseGiftFinderRequest(await request.json().catch(() => null));
  if (!input) return Response.json(null, { status: 400, headers });
  try {
    const listing = await getPublicFacetedCatalog(
      giftFinderFilters(input),
      undefined,
      request.signal,
    );
    if (listing.invalidFilters) return Response.json(null, { status: 400, headers });
    const items = listing.items.filter((item) => withinGiftBudget(item, input.budget));
    const minPrice = listing.facets.priceToman?.min;
    const results: GiftFinderResults = {
      items,
      totalPages: listing.totalPages,
      suggestedBudget:
        !items.length && minPrice !== undefined && minPrice > input.budget ? minPrice : null,
    };
    return Response.json(results, { headers });
  } catch {
    return Response.json(null, { status: 502, headers });
  }
}
