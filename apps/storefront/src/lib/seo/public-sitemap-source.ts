import type { components } from '@hamidian/contracts';
import { unstable_cache } from 'next/cache';
import { cache } from 'react';

import { createServerApiClient } from '@/lib/api/server-client';

export type PublicSeoSitemap = components['schemas']['PublicSeoSitemapResponseDto'];

function requiredApiOrigin(): string {
  const apiOrigin = process.env.HAMIDIAN_API_ORIGIN;
  if (!apiOrigin) {
    throw new Error('HAMIDIAN_API_ORIGIN is required for the storefront sitemap.');
  }
  return apiOrigin;
}

const getCachedPublicSeoSitemap = unstable_cache(
  async (apiOrigin: string): Promise<PublicSeoSitemap> => {
    const client = createServerApiClient({ apiOrigin });
    const result = await client.GET('/api/v1/seo/sitemap');

    if (!result.response.ok || !result.data) {
      throw new Error('Failed to load the public SEO sitemap source.');
    }

    return result.data;
  },
  ['storefront-public-seo-sitemap'],
  { revalidate: 60 },
);

export const getPublicSeoSitemap = cache(() => getCachedPublicSeoSitemap(requiredApiOrigin()));
