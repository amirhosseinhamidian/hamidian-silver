import { FestivalAnalyticsView } from '@/components/growth/festival-analytics-view';
import { requireAdminSession } from '@/lib/auth/session';
import { isCampaignId } from '@/lib/campaigns/campaign-model';
import { parseFestivalFilters } from '@/lib/growth/festival-report';
import { loadFestivalAnalytics } from '@/lib/growth/growth-data';

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = 'force-dynamic';

export default async function FestivalAnalyticsPage({ params, searchParams }: Props) {
  const { id } = await params;
  const path = `/growth/festivals/${encodeURIComponent(id)}`;
  const user = await requireAdminSession({ permissions: ['finance.read'], returnTo: path });
  const filters = parseFestivalFilters(await searchParams);
  const result = isCampaignId(id)
    ? await loadFestivalAnalytics(id, filters)
    : { report: null, status: 404 };
  const canReadOrders = user.permissions.includes('orders.read');
  return (
    <FestivalAnalyticsView
      {...result}
      filters={filters}
      path={path}
      canReadOrders={canReadOrders}
      canReadOperations={canReadOrders && user.permissions.includes('settings.read')}
      canPickCatalog={user.permissions.includes('settings.read')}
    />
  );
}
