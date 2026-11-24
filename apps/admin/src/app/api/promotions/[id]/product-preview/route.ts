import { isCampaignId } from '@/lib/campaigns/campaign-model';
import { readSiteSettingsJson } from '@/lib/site-settings/site-settings-bff';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const slug = new URL(request.url).searchParams.get('slug')?.trim();
  if (!isCampaignId(id) || !slug || slug.length > 220) {
    return Response.json({ message: 'Invalid campaign or product.' }, { status: 400 });
  }
  const query = new URLSearchParams({ slug });
  return readSiteSettingsJson(`/api/v1/promotions/${id}/product-preview?${query}`);
}
