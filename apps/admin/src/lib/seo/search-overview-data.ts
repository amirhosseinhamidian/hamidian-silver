import 'server-only';

import { cookies } from 'next/headers';
import { createAdminApiClient } from '@/lib/auth/server-api';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';
import type { OverviewFilters } from './search-overview-model';

export async function loadSearchOverview(filters: OverviewFilters) {
  const empty = { overview: null, rows: null, activePauseUntil: null };
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) return { ...empty, overviewStatus: 401, rowsStatus: 401 };
  try {
    const client = createAdminApiClient(token);
    const [overview, rows] = await Promise.allSettled([
      client.GET('/api/v1/seo/search-overview', {
        params: { query: filters.base },
        cache: 'no-store',
      }),
      client.GET('/api/v1/seo/search-overview/rows', {
        params: { query: filters.rows },
        cache: 'no-store',
      }),
    ]);
    const report = overview.status === 'fulfilled' ? (overview.value.data ?? null) : null;
    const pausedUntil = report?.sync.pausedUntil;
    return {
      overview: report,
      activePauseUntil: pausedUntil && Date.parse(pausedUntil) > Date.now() ? pausedUntil : null,
      rows: rows.status === 'fulfilled' ? (rows.value.data ?? null) : null,
      overviewStatus: overview.status === 'fulfilled' ? overview.value.response.status : 502,
      rowsStatus: rows.status === 'fulfilled' ? rows.value.response.status : 502,
    };
  } catch {
    return { ...empty, overviewStatus: 502, rowsStatus: 502 };
  }
}
