import { getPublicCampaignActivity } from '@/lib/campaigns/public-campaigns';

export async function GET() {
  const activity = await getPublicCampaignActivity();
  return Response.json(activity, {
    status: activity ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}
