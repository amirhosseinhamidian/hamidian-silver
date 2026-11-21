import 'server-only';

import { cookies } from 'next/headers';
import { createAdminApiClient } from '@/lib/auth/server-api';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';
import { growthQuery, type GrowthDashboard, type GrowthFilters } from '@/lib/growth/growth-report';

type ReportEndpoint =
  '/api/v1/growth-attribution/dashboard' | '/api/v1/growth-attribution/dashboard/costs';

async function apiClient() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  return token ? createAdminApiClient(token) : null;
}

async function loadResource(path: ReportEndpoint, filters: GrowthFilters) {
  try {
    const client = await apiClient();
    if (!client) return { data: null, status: 401 };
    const costs = path.endsWith('/costs');
    const query = {
      ...Object.fromEntries(growthQuery(filters, costs)),
      from: filters.from,
      to: filters.to,
      page: costs ? filters.costPage : filters.page,
    };
    const result = await client.GET(path, { params: { query }, cache: 'no-store' });
    return { data: result.data ?? null, status: result.response.status };
  } catch {
    return { data: null, status: 502 };
  }
}

export async function loadGrowthDashboard(filters: GrowthFilters) {
  const [dashboard, costs] = await Promise.all([
    loadResource('/api/v1/growth-attribution/dashboard', filters),
    loadResource('/api/v1/growth-attribution/dashboard/costs', filters),
  ]);
  return {
    report: dashboard.data && 'totals' in dashboard.data ? dashboard.data : null,
    status: dashboard.status,
    costs: costs.data && 'items' in costs.data && !('totals' in costs.data) ? costs.data : null,
  };
}

export async function loadGrowthExport(filters: GrowthFilters): Promise<{
  data: GrowthDashboard | null;
  status: number;
}> {
  const { data, status } = await loadResource('/api/v1/growth-attribution/dashboard', filters);
  return { data: data && 'totals' in data ? data : null, status };
}
