import type { paths } from '@hamidian/contracts';
import createClient from 'openapi-fetch';

type Fetch = typeof globalThis.fetch;

export type ServerApiClientOptions = Readonly<{
  apiOrigin: string;
  accessToken?: string;
  fetch?: Fetch;
}>;

/**
 * Low-level typed transport for server-side backend calls.
 *
 * Authenticated browser mutations must terminate at same-origin Next handlers;
 * bearer session tokens must not be exposed to Client Components.
 */
export function createServerApiClient({ apiOrigin, accessToken, fetch }: ServerApiClientOptions) {
  return createClient<paths>({
    baseUrl: normalizeApiOrigin(apiOrigin),
    fetch,
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
  });
}

export function normalizeApiOrigin(apiOrigin: string): string {
  const url = new URL(apiOrigin);

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new TypeError('API origin must use HTTP or HTTPS.');
  }

  if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new TypeError('API origin must not include credentials, a path, query, or fragment.');
  }

  return url.origin;
}
