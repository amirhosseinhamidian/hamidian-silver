import 'server-only';

import { cookies } from 'next/headers';

import { createAdminApiClient } from '@/lib/auth/server-api';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';
import {
  normalizeAdminProfileName,
  type AdminProfileIdentity,
} from '@/lib/profile/admin-profile-model';

export async function loadAdminProfileIdentity(): Promise<AdminProfileIdentity | null> {
  const accessToken = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!accessToken) return null;

  try {
    const { data, response } = await createAdminApiClient(accessToken).GET('/api/v1/profile');
    if (!response.ok || !data) return null;

    return {
      firstName: normalizeAdminProfileName(data.firstName),
      lastName: normalizeAdminProfileName(data.lastName),
    };
  } catch {
    return null;
  }
}
