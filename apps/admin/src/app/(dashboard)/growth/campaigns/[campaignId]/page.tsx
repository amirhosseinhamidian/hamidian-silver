import { GrowthCampaignPerformanceView } from '@/components/growth/growth-campaign-performance-view';
import { requireAdminSession } from '@/lib/auth/session';
import { loadCampaignPerformance } from '@/lib/growth/growth-data';
import { parseGrowthFilters } from '@/lib/growth/growth-report';

type PageProps = {
  params: Promise<{ campaignId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = 'force-dynamic';

export default async function GrowthCampaignPage({ params, searchParams }: PageProps) {
  const { campaignId } = await params;
  const path = `/growth/campaigns/${encodeURIComponent(campaignId)}`;
  const user = await requireAdminSession({ permissions: ['finance.read'], returnTo: path });
  const { from, to, page } = parseGrowthFilters(await searchParams);
  const result = /^[a-z0-9][a-z0-9._-]{0,63}$/.test(campaignId)
    ? await loadCampaignPerformance(campaignId, { from, to, page })
    : { report: null, status: 404 };

  return (
    <GrowthCampaignPerformanceView
      {...result}
      from={from}
      to={to}
      path={path}
      canReadOrders={user.permissions.includes('orders.read')}
    />
  );
}
