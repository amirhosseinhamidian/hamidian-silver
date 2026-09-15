import 'server-only';

import { normalizeApiOrigin } from '@/lib/api/server-client';

export async function requestAdminCatalog(
  path: string,
  accessToken: string,
  init: RequestInit = {},
): Promise<Response> {
  const configuredOrigin = process.env.HAMIDIAN_API_ORIGIN;
  if (!configuredOrigin) {
    throw new Error('HAMIDIAN_API_ORIGIN is required for the admin application.');
  }

  return fetch(`${normalizeApiOrigin(configuredOrigin)}${path}`, {
    ...init,
    cache: init.cache ?? 'no-store',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
      ...init.headers,
    },
  });
}

export async function readJsonResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type');
  if (!contentType?.includes('application/json')) return null;
  return response.json();
}
