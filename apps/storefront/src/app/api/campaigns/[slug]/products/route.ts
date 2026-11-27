import { getPublicCampaignLanding } from '@/lib/campaigns/public-campaigns';
import { maxCatalogFacetPage, readCatalogFacetPage } from '@/lib/catalog/catalog-pagination';

const headers = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' };

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const { searchParams } = new URL(request.url);
  const page = readCatalogFacetPage(searchParams.getAll('page'));
  if (
    !page ||
    page > maxCatalogFacetPage ||
    slug.length > 64 ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
  )
    return Response.json({ message: 'صفحهٔ کمپین معتبر نیست.' }, { headers, status: 400 });
  try {
    const landing = await getPublicCampaignLanding(slug, page, searchParams.toString(), true);
    if (!landing?.active) return Response.json(null, { headers, status: 404 });
    return Response.json(
      {
        ...landing.products,
        totalPages: Math.min(landing.products.totalPages, maxCatalogFacetPage),
      },
      { headers },
    );
  } catch {
    return Response.json({ message: 'بارگذاری محصولات ممکن نشد.' }, { headers, status: 502 });
  }
}
