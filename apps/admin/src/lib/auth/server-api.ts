import 'server-only';

import { createServerApiClient } from '@/lib/api/server-client';

export function createAdminApiClient(accessToken?: string) {
  const apiOrigin = process.env.HAMIDIAN_API_ORIGIN;

  if (!apiOrigin) {
    throw new Error('HAMIDIAN_API_ORIGIN is required for the admin application.');
  }

  return createServerApiClient({
    apiOrigin,
    accessToken,
  });
}
