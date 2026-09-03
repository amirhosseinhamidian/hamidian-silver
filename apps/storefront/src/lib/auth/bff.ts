import type { components } from '@hamidian/contracts';
import { cookies } from 'next/headers';

import { createServerApiClient } from '@/lib/api/server-client';

import {
  createClearedSessionCookieOptions,
  createSessionCookieOptions,
  SESSION_COOKIE_NAME,
  toBrowserLoginResponse,
} from './session-cookie';

type RequestOtpBody = components['schemas']['RequestOtpDto'];
type VerifyOtpBody = components['schemas']['VerifyOtpDto'];

function createApiClient(accessToken?: string) {
  const apiOrigin = process.env.HAMIDIAN_API_ORIGIN;

  if (!apiOrigin) {
    throw new Error('HAMIDIAN_API_ORIGIN is required for the frontend auth BFF.');
  }

  return createServerApiClient({
    apiOrigin,
    accessToken,
  });
}

function responseFromApi(response: Response, payload: unknown): Response {
  if (response.status === 204) {
    return new Response(null, { status: 204 });
  }

  return Response.json(payload ?? null, { status: response.status });
}

function upstreamContractError(): Response {
  return Response.json(
    { message: 'Unexpected response from the authentication service.' },
    { status: 502 },
  );
}

async function getSessionToken(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE_NAME)?.value;
}

async function setSessionCookie(accessToken: string, expiresAt: string): Promise<void> {
  (await cookies()).set(SESSION_COOKIE_NAME, accessToken, createSessionCookieOptions(expiresAt));
}

async function clearSessionCookie(): Promise<void> {
  (await cookies()).set(SESSION_COOKIE_NAME, '', createClearedSessionCookieOptions());
}

export async function requestOtp(request: Request): Promise<Response> {
  const body = (await request.json()) as RequestOtpBody;
  const client = createApiClient();
  const { data, error, response } = await client.POST('/api/v1/auth/otp/request', {
    body,
  });

  return responseFromApi(response, data ?? error);
}

export async function verifyOtp(request: Request): Promise<Response> {
  const body = (await request.json()) as VerifyOtpBody;
  const client = createApiClient();
  const { data, error, response } = await client.POST('/api/v1/auth/otp/verify', {
    body,
  });

  if (!response.ok) {
    return responseFromApi(response, error);
  }

  if (!data) {
    return upstreamContractError();
  }

  await setSessionCookie(data.accessToken, data.expiresAt);

  return Response.json(toBrowserLoginResponse(data));
}

export async function getCurrentUser(): Promise<Response> {
  const accessToken = await getSessionToken();

  if (!accessToken) {
    return Response.json({ message: 'Authentication required.' }, { status: 401 });
  }

  const client = createApiClient(accessToken);
  const { data, error, response } = await client.GET('/api/v1/auth/me');

  if (response.status === 401) {
    await clearSessionCookie();
  }

  if (!response.ok) {
    return responseFromApi(response, error);
  }

  if (!data) {
    return upstreamContractError();
  }

  return Response.json(data);
}

export async function logout(): Promise<Response> {
  const accessToken = await getSessionToken();

  if (!accessToken) {
    await clearSessionCookie();
    return new Response(null, { status: 204 });
  }

  const client = createApiClient(accessToken);

  try {
    const { error, response } = await client.POST('/api/v1/auth/logout');

    if (response.ok || response.status === 401) {
      return new Response(null, { status: 204 });
    }

    return responseFromApi(response, error);
  } finally {
    await clearSessionCookie();
  }
}

export async function logoutAll(): Promise<Response> {
  const accessToken = await getSessionToken();

  if (!accessToken) {
    await clearSessionCookie();
    return new Response(null, { status: 204 });
  }

  const client = createApiClient(accessToken);

  try {
    const { error, response } = await client.POST('/api/v1/auth/logout-all');

    if (response.ok || response.status === 401) {
      return new Response(null, { status: 204 });
    }

    return responseFromApi(response, error);
  } finally {
    await clearSessionCookie();
  }
}
