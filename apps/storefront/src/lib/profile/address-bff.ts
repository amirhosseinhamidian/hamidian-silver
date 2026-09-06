import type { components } from '@hamidian/contracts';
import { cookies } from 'next/headers';

import { createServerApiClient } from '@/lib/api/server-client';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';

type CreateAddressBody = components['schemas']['CreateUserAddressDto'];
type UpdateAddressBody = components['schemas']['UpdateUserAddressDto'];

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

export async function listAddresses(): Promise<Response> {
  const accessToken = await sessionToken();
  if (!accessToken) return authenticationRequired();

  const client = createApiClient(accessToken);
  const { data, error, response } = await client.GET('/api/v1/profile/addresses');
  return Response.json(data ?? error ?? null, { status: response.status });
}

export async function createAddress(request: Request): Promise<Response> {
  const accessToken = await sessionToken();
  if (!accessToken) return authenticationRequired();

  const body = (await request.json()) as CreateAddressBody;
  const client = createApiClient(accessToken);
  const { data, error, response } = await client.POST('/api/v1/profile/addresses', { body });
  return Response.json(data ?? error ?? null, { status: response.status });
}

export async function updateAddress(request: Request, addressId: string): Promise<Response> {
  const accessToken = await sessionToken();
  if (!accessToken) return authenticationRequired();

  const body = (await request.json()) as UpdateAddressBody;
  const client = createApiClient(accessToken);
  const { data, error, response } = await client.PATCH('/api/v1/profile/addresses/{addressId}', {
    params: { path: { addressId } },
    body,
  });
  return Response.json(data ?? error ?? null, { status: response.status });
}

export async function deleteAddress(addressId: string): Promise<Response> {
  const accessToken = await sessionToken();
  if (!accessToken) return authenticationRequired();

  const client = createApiClient(accessToken);
  const { data, error, response } = await client.DELETE('/api/v1/profile/addresses/{addressId}', {
    params: { path: { addressId } },
  });
  return Response.json(data ?? error ?? null, { status: response.status });
}

export async function setDefaultAddress(addressId: string): Promise<Response> {
  const accessToken = await sessionToken();
  if (!accessToken) return authenticationRequired();

  const client = createApiClient(accessToken);
  const { data, error, response } = await client.PATCH(
    '/api/v1/profile/addresses/{addressId}/default',
    { params: { path: { addressId } } },
  );
  return Response.json(data ?? error ?? null, { status: response.status });
}
