import { GrowthDashboardView } from '@/components/growth/growth-dashboard-view';
import { CartRecoveryReport } from '@/components/growth/cart-recovery-report';
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
    <div className="space-y-6">
      <GrowthDashboardView
        filters={filters}
        {...result}
        canWriteCosts={user.permissions.includes('finance.write')}
      />
      <CartRecoveryReport canEdit={user.permissions.includes('settings.write')} />
    </div>
  );
}
