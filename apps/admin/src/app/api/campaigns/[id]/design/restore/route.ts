import { isCampaignId } from '@/lib/campaigns/campaign-model';
import { forwardSiteSettingsJson } from '@/lib/site-settings/site-settings-bff';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isCampaignId(id)) return Response.json({ message: 'Invalid campaign ID.' }, { status: 400 });
  const response = await forwardSiteSettingsJson(
    request,
    `/api/v1/campaigns/${id}/design/restore`,
    'POST',
  );
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
