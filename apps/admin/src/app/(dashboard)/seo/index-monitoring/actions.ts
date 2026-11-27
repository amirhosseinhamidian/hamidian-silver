'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createAdminApiClient } from '@/lib/auth/server-api';
import { requireAdminSession } from '@/lib/auth/session';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';
import { readJsonResponse, requestAdminCatalog } from '@/lib/catalog/catalog-api';

const indexPath = '/seo/index-monitoring';
const coveragePath = '/seo/index-monitoring/coverage-reports';

export async function queueIndexSample() {
  await requireAdminSession({ permissions: ['settings.write'], returnTo: indexPath });
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  let result = 'unavailable';
  if (token) {
    try {
      const { data } = await createAdminApiClient(token).POST('/api/v1/seo/index-monitoring/queue');
      if (data) result = data.queued ? 'queued' : 'no-new-sample';
    } catch {
      // The report displays a generic service error.
    }
  }
  redirect(`${indexPath}?result=${result}`);
}

export async function uploadSearchCoverage(form: FormData) {
  await requireAdminSession({ permissions: ['settings.write'], returnTo: coveragePath });
  const file = form.get('file');
  const label = form.get('label');
  const reportDate = form.get('reportDate');
  if (
    !(file instanceof File) ||
    !file.size ||
    file.size > 750 * 1024 ||
    typeof label !== 'string' ||
    typeof reportDate !== 'string'
  ) {
    redirect(`${coveragePath}?result=invalid`);
  }

  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  let location = `${coveragePath}?result=unavailable`;
  if (token) {
    try {
      const payload = new FormData();
      payload.set('file', file);
      payload.set('label', label);
      payload.set('reportDate', reportDate);
      const response = await requestAdminCatalog('/api/v1/seo/index-monitoring/coverage', token, {
        method: 'POST',
        body: payload,
      });
      const data = (await readJsonResponse(response)) as { id?: unknown } | null;
      if (response.ok && typeof data?.id === 'string') {
        location = `${coveragePath}?id=${encodeURIComponent(data.id)}&result=imported`;
      } else if ([400, 413].includes(response.status)) {
        location = `${coveragePath}?result=invalid`;
      }
    } catch {
      // The report displays a generic service error.
    }
  }
  redirect(location);
}
