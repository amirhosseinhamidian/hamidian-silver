import type { components } from '@hamidian/contracts';
import { cookies } from 'next/headers';

import { createServerApiClient } from '@/lib/api/server-client';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';

type UpdateProfileBody = components['schemas']['UpdateProfileDto'];

function authenticationRequired(): Response {
  return Response.json({ message: 'Authentication required.' }, { status: 401 });
}

function createApiClient(accessToken: string) {
  const apiOrigin = process.env.HAMIDIAN_API_ORIGIN;

  if (!apiOrigin) {
    throw new Error('HAMIDIAN_API_ORIGIN is required for profile requests.');
  }

  return createServerApiClient({ apiOrigin, accessToken });
}

async function sessionToken(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE_NAME)?.value;
}

export async function getProfile(): Promise<Response> {
  const accessToken = await sessionToken();
  if (!accessToken) return authenticationRequired();

  const client = createApiClient(accessToken);
  const { data, error, response } = await client.GET('/api/v1/profile');
  return Response.json(data ?? error ?? null, { status: response.status });
}

export async function updateProfile(request: Request): Promise<Response> {
  const accessToken = await sessionToken();
  if (!accessToken) return authenticationRequired();

  const body = (await request.json()) as UpdateProfileBody;
  const client = createApiClient(accessToken);
  const { data, error, response } = await client.PATCH('/api/v1/profile', { body });
  return Response.json(data ?? error ?? null, { status: response.status });
}
