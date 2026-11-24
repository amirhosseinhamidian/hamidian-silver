import { isCampaignId } from '@/lib/campaigns/campaign-model';
import {
  forwardSiteSettingsJson,
  readSiteSettingsJson,
} from '@/lib/site-settings/site-settings-bff';

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Context) {
  const { id } = await params;
  if (!isCampaignId(id)) return Response.json({ message: 'Invalid campaign ID.' }, { status: 400 });

  const slug = new URL(request.url).searchParams.get('slug') ?? '';
  return readSiteSettingsJson(`/api/v1/campaigns/${id}/quota?${new URLSearchParams({ slug })}`);
}

export async function PUT(request: Request, { params }: Context) {
  const { id } = await params;
  if (!isCampaignId(id)) return Response.json({ message: 'Invalid campaign ID.' }, { status: 400 });
  return forwardSiteSettingsJson(request, `/api/v1/campaigns/${id}/quota`, 'PUT');
}
