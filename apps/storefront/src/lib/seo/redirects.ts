import { cache } from 'react';

import { createServerApiClient } from '@/lib/api/server-client';

const PUBLIC_CATALOG_PATH_PATTERN = /^\/(?:products|categories|brands)\/[^/?#\s]+$/;

export function validPublicCatalogRedirectPath(value: unknown): string | null {
  return typeof value === 'string' && PUBLIC_CATALOG_PATH_PATTERN.test(value) ? value : null;
}

export const getPublicSeoRedirect = cache(async (sourcePath: string): Promise<string | null> => {
  if (!validPublicCatalogRedirectPath(sourcePath)) return null;

  const apiOrigin = process.env.HAMIDIAN_API_ORIGIN;
  if (!apiOrigin) return null;

  const client = createServerApiClient({ apiOrigin });
  const result = await client.GET('/api/v1/seo/redirects/resolve', {
    params: { query: { path: sourcePath } },
    cache: 'no-store',
  });

  if (result.response.status === 404) return null;
  if (!result.response.ok || !result.data) {
    throw new Error('Failed to resolve the legacy storefront path.');
  }

  const destinationPath = validPublicCatalogRedirectPath(result.data.destinationPath);
  if (!destinationPath) {
    throw new Error('The SEO redirect destination is invalid.');
  }

  return destinationPath;
});
