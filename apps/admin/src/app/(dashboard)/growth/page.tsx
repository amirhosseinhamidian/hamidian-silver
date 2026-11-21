import { GrowthDashboardView } from '@/components/growth/growth-dashboard-view';
import { requireAdminSession } from '@/lib/auth/session';
import { loadGrowthDashboard } from '@/lib/growth/growth-data';
import { parseGrowthFilters } from '@/lib/growth/growth-report';

type GrowthPageProps = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

export const dynamic = 'force-dynamic';

export default async function GrowthPage({ searchParams }: GrowthPageProps) {
  const user = await requireAdminSession({ permissions: ['finance.read'], returnTo: '/growth' });
  const filters = parseGrowthFilters(await searchParams);
  const result = await loadGrowthDashboard(filters);
  return (
    <GrowthDashboardView
      filters={filters}
      {...result}
      canWriteCosts={user.permissions.includes('finance.write')}
    />
  );
}
