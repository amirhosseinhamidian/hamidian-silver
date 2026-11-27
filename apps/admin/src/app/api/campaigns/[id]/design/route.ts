import { isCampaignId } from '@/lib/campaigns/campaign-model';
import { forwardSiteSettingsJson } from '@/lib/site-settings/site-settings-bff';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isCampaignId(id)) return Response.json({ message: 'Invalid campaign ID.' }, { status: 400 });
  const response = await forwardSiteSettingsJson(request, `/api/v1/campaigns/${id}/design`, 'PUT');
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
