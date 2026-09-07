import { AdminDashboardView } from '@/components/dashboard/admin-dashboard-view';
import { requireAdminSession } from '@/lib/auth/session';
import { loadAdminDashboard } from '@/lib/dashboard/dashboard-data';
import { parseDashboardPeriod } from '@/lib/dashboard/dashboard-model';

type AdminHomePageProps = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

export const dynamic = 'force-dynamic';

export default async function AdminHomePage({ searchParams }: AdminHomePageProps) {
  const user = await requireAdminSession();
  const period = parseDashboardPeriod((await searchParams).period);
  const data = await loadAdminDashboard(user, period);

  return <AdminDashboardView data={data} />;
}
