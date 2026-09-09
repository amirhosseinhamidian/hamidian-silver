import 'server-only';

import type { components } from '@hamidian/contracts';
import { cookies } from 'next/headers';

import { createAdminApiClient } from '@/lib/auth/server-api';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';
import { normalizeAdminProfileName } from '@/lib/profile/admin-profile-model';

type UpdateProfileBody = components['schemas']['UpdateProfileDto'];

function responseFromApi(response: Response, payload: unknown): Response {
  return Response.json(payload ?? null, { status: response.status });
}

export async function updateAdminProfile(request: Request): Promise<Response> {
  const accessToken = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!accessToken) {
    return Response.json({ message: 'Authentication required.' }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ message: 'اطلاعات ارسالی معتبر نیست.' }, { status: 400 });
  }

  if (typeof payload !== 'object' || payload === null) {
    return Response.json({ message: 'اطلاعات ارسالی معتبر نیست.' }, { status: 400 });
  }

  const record = payload as Record<string, unknown>;
  const firstName =
    typeof record.firstName === 'string' ? normalizeAdminProfileName(record.firstName) : null;
  const lastName =
    typeof record.lastName === 'string' ? normalizeAdminProfileName(record.lastName) : null;

  if (!firstName || !lastName || firstName.length > 100 || lastName.length > 100) {
    return Response.json(
      { message: 'نام و نام خانوادگی باید بین ۱ تا ۱۰۰ کاراکتر باشند.' },
      { status: 400 },
    );
  }

  const body: UpdateProfileBody = { firstName, lastName };

  try {
    const { data, error, response } = await createAdminApiClient(accessToken).PATCH(
      '/api/v1/profile',
      { body },
    );
    return responseFromApi(response, data ?? error);
  } catch {
    return Response.json({ message: 'سرویس پروفایل در دسترس نیست.' }, { status: 502 });
  }
}
