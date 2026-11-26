'use server';

import type { components } from '@hamidian/contracts';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createAdminApiClient } from '@/lib/auth/server-api';
import { requireAdminSession } from '@/lib/auth/session';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';
import { issueStatusLabels } from './issue-labels';

const route = '/seo/issues';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function scanSeoIssues() {
  await requireAdminSession({ permissions: ['settings.write'], returnTo: route });
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const response = token
    ? await createAdminApiClient(token)
        .POST('/api/v1/seo/issues/scan')
        .then(
          ({ data }) => data,
          () => undefined,
        )
    : undefined;
  redirect(`${route}?result=${response ? 'scanned' : 'unavailable'}`);
}

export async function saveSeoIssue(id: string, form: FormData) {
  if (!uuid.test(id)) redirect(route);
  const detail = `${route}/${id}`;
  await requireAdminSession({ permissions: ['settings.write'], returnTo: detail });
  const status = form.get('status');
  const ownerId = form.get('ownerId');
  const note = form.get('note');
  const revision = Number(form.get('revision'));
  if (
    !Number.isSafeInteger(revision) ||
    revision < 1 ||
    typeof status !== 'string' ||
    !Object.hasOwn(issueStatusLabels, status) ||
    typeof ownerId !== 'string' ||
    (ownerId !== '' && !uuid.test(ownerId)) ||
    typeof note !== 'string' ||
    note.length > 1000
  ) {
    redirect(`${detail}?result=invalid`);
  }
  const body: components['schemas']['SeoIssueUpdateDto'] = {
    revision,
    status: status as keyof typeof issueStatusLabels,
    ownerId: ownerId || null,
    note,
  };
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const outcome = token
    ? await createAdminApiClient(token)
        .PATCH('/api/v1/seo/issues/{id}', {
          params: { path: { id } },
          body,
        })
        .then(
          ({ data, response }) =>
            data ? 'saved' : response.status === 409 ? 'conflict' : 'invalid',
          () => 'unavailable',
        )
    : 'unavailable';
  redirect(`${detail}?result=${outcome}`);
}
