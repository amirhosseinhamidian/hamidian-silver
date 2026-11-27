import type { components } from '@hamidian/contracts';
import { cache } from 'react';

import { createServerApiClient } from '@/lib/api/server-client';

export const getPublicPromotions = cache(
  async (): Promise<components['schemas']['PublicPromotionsDto']> => {
    const apiOrigin = process.env.HAMIDIAN_API_ORIGIN;
    if (apiOrigin) {
      try {
        const { data } = await createServerApiClient({ apiOrigin }).GET(
          '/api/v1/promotions/public',
          {
            cache: 'no-store',
            signal: AbortSignal.timeout(1_500),
          },
        );
        if (data) return data;
      } catch {
        // Regular catalog prices remain available if campaigns cannot be loaded.
      }
    }
    return { available: false, items: [] };
  },
);
