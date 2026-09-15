import type { components } from '@hamidian/contracts';
import { cookies } from 'next/headers';

import { createServerApiClient, normalizeApiOrigin } from '@/lib/api/server-client';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';

type CreateOrderBody = components['schemas']['CreateOrderDto'];
type InitiatePaymentBody = components['schemas']['InitiatePaymentDto'];

type CheckoutPaymentRequest = InitiatePaymentBody & {
  orderId: string;
};

function createApiClient(accessToken: string) {
  const apiOrigin = process.env.HAMIDIAN_API_ORIGIN;

  if (!apiOrigin) {
    throw new Error('HAMIDIAN_API_ORIGIN is required for checkout requests.');
  }

  return createServerApiClient({ apiOrigin, accessToken });
}

function responseFromApi(response: Response, payload: unknown): Response {
  if (response.status === 204) {
    return new Response(null, { status: 204 });
  }

  return Response.json(payload ?? null, { status: response.status });
}

async function getSessionToken(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE_NAME)?.value;
}

function authenticationRequired(): Response {
  return Response.json({ message: 'Authentication required.' }, { status: 401 });
}

export async function createCheckoutOrder(request: Request): Promise<Response> {
  const accessToken = await getSessionToken();

  if (!accessToken) {
    return authenticationRequired();
  }

  const body = (await request.json()) as CreateOrderBody;
  const client = createApiClient(accessToken);
  const { data, error, response } = await client.POST('/api/v1/orders', { body });

  return responseFromApi(response, data ?? error);
}

export async function initiateCheckoutPayment(request: Request): Promise<Response> {
  const accessToken = await getSessionToken();

  if (!accessToken) {
    return authenticationRequired();
  }

  const body = (await request.json()) as CheckoutPaymentRequest;

  if (!body.orderId || typeof body.orderId !== 'string') {
    return Response.json({ message: 'orderId is required.' }, { status: 400 });
  }

  const { orderId, ...paymentBody } = body;
  const client = createApiClient(accessToken);
  const { data, error, response } = await client.POST(
    '/api/v1/payments/orders/{orderId}/initiate',
    {
      params: {
        path: { orderId },
      },
      body: paymentBody,
    },
  );

  return responseFromApi(response, data ?? error);
}

function apiOrigin(): string {
  const configuredOrigin = process.env.HAMIDIAN_API_ORIGIN;
  if (!configuredOrigin) {
    throw new Error('HAMIDIAN_API_ORIGIN is required for checkout requests.');
  }
  return normalizeApiOrigin(configuredOrigin);
}

async function forwardAuthenticatedResponse(
  path: string,
  accessToken: string,
  init: RequestInit = {},
): Promise<Response> {
  const response = await fetch(`${apiOrigin()}${path}`, {
    ...init,
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
      ...init.headers,
    },
  });

  return new Response(await response.arrayBuffer(), {
    status: response.status,
    headers: {
      'Content-Type': response.headers.get('content-type') ?? 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

export async function getCardToCardSettings(): Promise<Response> {
  const accessToken = await getSessionToken();
  if (!accessToken) return authenticationRequired();

  try {
    return await forwardAuthenticatedResponse(
      '/api/v1/payments/card-to-card/settings',
      accessToken,
    );
  } catch {
    return Response.json({ message: 'Payment service is unavailable.' }, { status: 502 });
  }
}

export async function submitCardToCardReceipt(request: Request): Promise<Response> {
  const accessToken = await getSessionToken();
  if (!accessToken) return authenticationRequired();

  const body = await request.formData();
  const orderId = body.get('orderId');
  if (typeof orderId !== 'string' || !orderId) {
    return Response.json({ message: 'orderId is required.' }, { status: 400 });
  }
  body.delete('orderId');

  try {
    return await forwardAuthenticatedResponse(
      `/api/v1/payments/orders/${encodeURIComponent(orderId)}/card-to-card/receipt`,
      accessToken,
      { method: 'POST', body },
    );
  } catch {
    return Response.json({ message: 'Payment service is unavailable.' }, { status: 502 });
  }
}
