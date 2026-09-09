import type { components } from '@hamidian/contracts';
import { cache } from 'react';

import { createServerApiClient } from '@/lib/api/server-client';

export type PublicContentPage = components['schemas']['PublicContentPageDto'];
export type PublicContentPageKey = components['schemas']['StorefrontContentPageKey'];

export const PUBLIC_CONTENT_PAGE_ROUTES: Readonly<Record<PublicContentPageKey, string>> = {
  ABOUT: '/about',
  CONTACT: '/contact',
  SERVICES: '/services',
  TERMS: '/terms',
  PRIVACY: '/privacy',
  SIZE_GUIDE: '/size-guide',
  FAQ: '/faq',
};

export const PUBLIC_CONTENT_PAGE_KEYS = Object.keys(
  PUBLIC_CONTENT_PAGE_ROUTES,
) as PublicContentPageKey[];

export const getPublicContentPage = cache(
  async (key: PublicContentPageKey): Promise<PublicContentPage> => {
    const apiOrigin = process.env.HAMIDIAN_API_ORIGIN;
    if (!apiOrigin) {
      throw new Error('HAMIDIAN_API_ORIGIN is required for storefront content pages.');
    }

    const client = createServerApiClient({ apiOrigin });
    const result = await client.GET('/api/v1/site-settings/public/pages/{key}', {
      params: { path: { key } },
      cache: 'no-store',
    });

    if (!result.response.ok || !result.data) {
      throw new Error(`Failed to load storefront content page: ${key}.`);
    }

    return result.data;
  },
);
