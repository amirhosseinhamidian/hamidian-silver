import { FinancialReportsView } from '@/components/financial-reports/financial-reports-view';
import { requireAdminSession } from '@/lib/auth/session';
import { loadAdminFinancialReports } from '@/lib/financial-reports/financial-reports-data';
import { parseFinancialReportPeriod } from '@/lib/financial-reports/financial-reports-model';

type FinancialReportsPageProps = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

export const dynamic = 'force-dynamic';

export default async function FinancialReportsPage({ searchParams }: FinancialReportsPageProps) {
  await requireAdminSession({ permissions: ['finance.read'], returnTo: '/finance' });
  const period = parseFinancialReportPeriod((await searchParams).period);
  const data = await loadAdminFinancialReports(period);

  return <FinancialReportsView data={data} />;
}
