import type { components } from '@hamidian/contracts';

import { createServerApiClient } from '@/lib/api/server-client';

export type PublicCampaignBanner = components['schemas']['CampaignBannerDto'];

export async function getPublicCampaignBanner(): Promise<PublicCampaignBanner | null> {
  const apiOrigin = process.env.HAMIDIAN_API_ORIGIN;
  if (!apiOrigin) return null;
  try {
    const result = await createServerApiClient({ apiOrigin }).GET(
      '/api/v1/campaigns/public/banner',
      {
        cache: 'no-store',
        signal: AbortSignal.timeout(1_500),
      },
    );
    return result.data?.banner ?? null;
  } catch {
    return null;
  }
}
