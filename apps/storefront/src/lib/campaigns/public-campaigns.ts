import type { components } from '@hamidian/contracts';
import { cache } from 'react';

import { campaignFilters } from './campaign-filters';
import { createServerApiClient } from '@/lib/api/server-client';

function campaignClient() {
  const apiOrigin = process.env.HAMIDIAN_API_ORIGIN;
  return apiOrigin ? createServerApiClient({ apiOrigin }) : null;
}

async function readPublicCampaignLanding(
  slug: string,
  page: number,
  filterQuery = '',
  productsOnly = false,
) {
  const client = campaignClient();
  if (!client) throw new Error('The campaign API origin is unavailable.');
  const result = await client.GET('/api/v1/campaigns/public/landing/{slug}', {
    params: {
      path: { slug },
      query: {
        page,
        ...campaignFilters(Object.fromEntries(new URLSearchParams(filterQuery))),
        ...(productsOnly ? { productsOnly: '1' } : {}),
      },
    },
    cache: 'no-store',
  });
  if (result.response.status === 404) return null;
  if (!result.data) throw new Error('Cannot load the campaign landing.');
  return result.data;
}

export const getPublicCampaignLanding = cache(readPublicCampaignLanding);
export async function getPublicCampaignPlacement(
  slot: 'CATEGORY' | 'PRODUCT' | 'COUNTDOWN' | 'NAVIGATION',
  slug?: string,
) {
  const client = campaignClient();
  if (!client) return null;
  try {
    const result = await client.GET('/api/v1/campaigns/public/placement', {
      params: { query: { slot, slug } },
      cache: 'no-store',
      signal: AbortSignal.timeout(1_500),
    });
    return result.data?.banner ?? null;
  } catch {
    return null;
  }
}

export async function getPublicCampaignSitemap(): Promise<
  components['schemas']['CampaignSitemapEntryDto'][]
> {
  const client = campaignClient();
  if (!client) return [];
  try {
    const result = await client.GET('/api/v1/campaigns/public/sitemap', {
      cache: 'no-store',
      signal: AbortSignal.timeout(3_000),
    });
    return result.data?.entries ?? [];
  } catch {
    return [];
  }
}

export async function getPublicCampaignActivity() {
  const client = campaignClient();
  if (!client) return null;
  try {
    const { data } = await client.GET('/api/v1/campaigns/public/activity', {
      cache: 'no-store',
      signal: AbortSignal.timeout(1_500),
    });
    return data ?? null;
  } catch {
    return null;
  }
}
