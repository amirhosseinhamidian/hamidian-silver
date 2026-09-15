import type { components } from '@hamidian/contracts';
import { cookies } from 'next/headers';

import { createServerApiClient } from '@/lib/api/server-client';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';

type CreateReturnBody = components['schemas']['CreateOrderReturnDto'];

function authenticationRequired(): Response {
  return Response.json({ message: 'Authentication required.' }, { status: 401 });
}

async function customerReturnsClient() {
  const accessToken = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!accessToken) return null;

  const apiOrigin = process.env.HAMIDIAN_API_ORIGIN;
  if (!apiOrigin) {
    throw new Error('HAMIDIAN_API_ORIGIN is required for customer return requests.');
  }

  return createServerApiClient({ apiOrigin, accessToken });
}

function apiResponse(response: Response, payload: unknown): Response {
  return Response.json(payload ?? null, { status: response.status });
}

export async function listCustomerOrderReturns(orderId: string): Promise<Response> {
  const client = await customerReturnsClient();
  if (!client) return authenticationRequired();

  const { data, error, response } = await client.GET('/api/v1/orders/me/{orderId}/returns', {
    params: { path: { orderId } },
  });

  return apiResponse(response, data ?? error);
}

export async function createCustomerOrderReturn(
  request: Request,
  orderId: string,
): Promise<Response> {
  const client = await customerReturnsClient();
  if (!client) return authenticationRequired();

  const body = (await request.json()) as CreateReturnBody;
  const { data, error, response } = await client.POST('/api/v1/orders/me/{orderId}/returns', {
    params: { path: { orderId } },
    body,
  });

  return apiResponse(response, data ?? error);
}

export async function cancelCustomerOrderReturn(returnId: string): Promise<Response> {
  const client = await customerReturnsClient();
  if (!client) return authenticationRequired();

  const { data, error, response } = await client.POST(
    '/api/v1/orders/me/returns/{returnId}/cancel',
    {
      params: { path: { returnId } },
      body: { reason: 'Cancelled by customer' },
    },
  );

  return apiResponse(response, data ?? error);
}
