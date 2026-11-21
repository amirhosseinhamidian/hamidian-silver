import 'server-only';

import { cookies } from 'next/headers';
import { createAdminApiClient } from '@/lib/auth/server-api';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';
import type { EntityIdentity, readEntityFilters } from './search-entity-model';

type Filters = ReturnType<typeof readEntityFilters>;

async function apiClient() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  return token ? createAdminApiClient(token) : null;
}

export async function loadSearchEntityList(query: Filters['list']) {
  try {
    const client = await apiClient();
    if (!client) return { data: null, status: 401 };
    const response = await client.GET('/api/v1/seo/search-entities', {
      params: { query },
      cache: 'no-store',
    });
    return { data: response.data ?? null, status: response.response.status };
  } catch {
    return { data: null, status: 502 };
  }
}

export async function loadSearchEntityDetail(
  kind: EntityIdentity['kind'],
  id: string,
  query: Filters['detail'],
) {
  try {
    const client = await apiClient();
    if (!client) return { data: null, status: 401 };
    const response = await client.GET('/api/v1/seo/search-entities/{kind}/{id}', {
      params: { path: { kind, id }, query },
      cache: 'no-store',
    });
    return { data: response.data ?? null, status: response.response.status };
  } catch {
    return { data: null, status: 502 };
  }
}
