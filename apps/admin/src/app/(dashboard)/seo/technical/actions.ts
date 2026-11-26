'use server';

import { refresh } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createAdminApiClient } from '@/lib/auth/server-api';
import { requireAdminSession } from '@/lib/auth/session';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';

export async function startTechnicalAudit() {
  await requireAdminSession({ permissions: ['settings.write'], returnTo: '/seo/technical' });
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  let destination = '/seo/technical?result=unavailable';
  if (token) {
    try {
      const { data, response } = await createAdminApiClient(token).POST(
        '/api/v1/seo/technical-audits',
      );
      if (data) destination = `/seo/technical?runId=${encodeURIComponent(data.id)}`;
      else if (response.status === 409) destination = '/seo/technical?result=running';
    } catch {
      // The result message is rendered on the audit page.
    }
  }
  redirect(destination);
}

export async function refreshTechnicalAudit() {
  await requireAdminSession({ permissions: ['settings.read'], returnTo: '/seo/technical' });
  refresh();
}
