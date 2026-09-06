import 'server-only';

import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';

import {
  evaluateAdminAccess,
  type AdminCurrentUser,
  type AdminPermission,
} from '@/lib/auth/access-control';
import { ADMIN_RETURN_TO_HEADER, buildAdminLoginPath } from '@/lib/auth/login-redirect';
import { createAdminApiClient } from '@/lib/auth/server-api';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';
import { verifyAdminAccessToken } from '@/lib/auth/session-verification';

export async function loadAdminCurrentUser(): Promise<AdminCurrentUser | null> {
  const accessToken = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!accessToken) return null;

  return verifyAdminAccessToken(accessToken, async (token) => {
    const { data, response } = await createAdminApiClient(token).GET('/api/v1/auth/me');
    return { data, response };
  });
}

export const getAdminCurrentUser = cache(loadAdminCurrentUser);

type RequireAdminSessionOptions = Readonly<{
  permissions?: readonly AdminPermission[];
  returnTo?: string;
}>;

export async function requireAdminSession({
  permissions = [],
  returnTo,
}: RequireAdminSessionOptions = {}): Promise<AdminCurrentUser> {
  const user = await getAdminCurrentUser();

  if (!user) {
    const requestedPath = returnTo ?? (await headers()).get(ADMIN_RETURN_TO_HEADER) ?? '/';
    redirect(buildAdminLoginPath(requestedPath));
  }
  if (evaluateAdminAccess(user, permissions) === 'forbidden') redirect('/access-denied');

  return user;
}
