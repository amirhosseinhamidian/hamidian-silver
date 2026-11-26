'use server';

import type { components } from '@hamidian/contracts';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createAdminApiClient } from '@/lib/auth/server-api';
import { requireAdminSession } from '@/lib/auth/session';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';
import { actionLabels, opportunityPath, type OpportunityAction } from './opportunity-labels';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function refreshSeoOpportunities() {
  await requireAdminSession({ permissions: ['settings.write'], returnTo: opportunityPath });
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const data = token
    ? await createAdminApiClient(token)
        .POST('/api/v1/seo/opportunities/refresh')
        .then(
          ({ data }) => data,
          () => undefined,
        )
    : undefined;
  const result = !data ? 'unavailable' : data.hasSource ? 'refreshed' : 'no-data';
  redirect(`${opportunityPath}?result=${result}`);
}

export async function updateSeoOpportunity(id: string, form: FormData) {
  if (!uuid.test(id)) redirect(opportunityPath);
  const path = `${opportunityPath}/${id}`;
  await requireAdminSession({ permissions: ['settings.write'], returnTo: path });
  const action = form.get('action');
  const note = form.get('note');
  const date = form.get('date');
  const confounders = form.get('confounders');
  const window = form.get('windowDays');
  const revision = Number(form.get('revision'));
  if (
    !Number.isSafeInteger(revision) ||
    revision < 1 ||
    typeof action !== 'string' ||
    !Object.hasOwn(actionLabels, action)
  )
    redirect(`${path}?result=invalid`);
  const windowDays = Number(window);
  const body: components['schemas']['SeoOpportunityUpdateDto'] = {
    action: action as OpportunityAction,
    revision,
    ...(typeof note === 'string' && note ? { note } : {}),
    ...(typeof date === 'string' && date ? { date } : {}),
    ...(typeof confounders === 'string' && confounders ? { confounders } : {}),
    ...(windowDays === 7 || windowDays === 14 || windowDays === 28 ? { windowDays } : {}),
  };
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const outcome = token
    ? await createAdminApiClient(token)
        .PATCH('/api/v1/seo/opportunities/{id}', {
          params: { path: { id } },
          body,
        })
        .then(
          ({ data, response }) =>
            data ? 'saved' : response.status === 409 ? 'conflict' : 'invalid',
          () => 'unavailable',
        )
    : 'unavailable';
  redirect(`${path}?result=${outcome}`);
}
