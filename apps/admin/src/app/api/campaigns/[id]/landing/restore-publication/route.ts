import { isCampaignId } from '@/lib/campaigns/campaign-model';
import { forwardSiteSettingsJson } from '@/lib/site-settings/site-settings-bff';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const response = isCampaignId(id)
    ? await forwardSiteSettingsJson(
        request,
        `/api/v1/campaigns/${id}/landing/restore-publication`,
        'POST',
      )
    : Response.json({ message: 'Invalid campaign ID.' }, { status: 400 });
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
