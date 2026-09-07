import type { components } from '@hamidian/contracts';
import { cache } from 'react';

import { createServerApiClient } from '@/lib/api/server-client';

export type PublicSiteSettings = components['schemas']['PublicSiteSettingsDto'];

const DEFAULT_PUBLIC_SITE_SETTINGS: PublicSiteSettings = {
  catalogHeroEnabled: false,
  catalogHeroTitle: null,
  catalogHeroSubtitle: null,
  catalogHeroMedia: null,
  galleryName: null,
  footerAbout: null,
  contactAddress: null,
  contactPhoneNumbers: [],
  contactEmail: null,
  instagramUrl: null,
  telegramUrl: null,
  baleUrl: null,
};

export const getPublicSiteSettings = cache(async (): Promise<PublicSiteSettings> => {
  const apiOrigin = process.env.HAMIDIAN_API_ORIGIN;

  if (!apiOrigin) {
    return DEFAULT_PUBLIC_SITE_SETTINGS;
  }

  try {
    const client = createServerApiClient({ apiOrigin });
    const result = await client.GET('/api/v1/site-settings/public', {
      cache: 'no-store',
    });

    if (!result.response.ok || !result.data) {
      return DEFAULT_PUBLIC_SITE_SETTINGS;
    }

    return result.data;
  } catch {
    return DEFAULT_PUBLIC_SITE_SETTINGS;
  }
});
