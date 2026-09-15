import type { components } from '@hamidian/contracts';

import { createServerApiClient } from '@/lib/api/server-client';

export type PublicHomepage = components['schemas']['PublicHomepageDto'];
export type PublicHomepageHeroSlide = components['schemas']['PublicHomepageHeroSlideDto'];
export type PublicHomepageFeaturedCategory =
  components['schemas']['PublicHomepageFeaturedCategoryDto'];
export type PublicHomepageManufacturerCountry =
  components['schemas']['PublicHomepageManufacturerCountryDto'];

export async function getPublicHomepage(): Promise<PublicHomepage> {
  const apiOrigin = process.env.HAMIDIAN_API_ORIGIN;

  if (!apiOrigin) {
    throw new Error('HAMIDIAN_API_ORIGIN is required for the storefront homepage.');
  }

  const client = createServerApiClient({ apiOrigin });
  const result = await client.GET('/api/v1/site-settings/public/homepage', {
    cache: 'no-store',
  });

  if (!result.response.ok || !result.data) {
    throw new Error('Failed to load the public storefront homepage.');
  }

  return result.data;
}
