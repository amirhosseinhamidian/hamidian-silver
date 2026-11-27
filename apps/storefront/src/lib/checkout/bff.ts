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

export async function quoteCheckoutOrder(request: Request): Promise<Response> {
  const accessToken = await getSessionToken();
  if (!accessToken) return authenticationRequired();
  try {
    const body = (await request.json()) as CreateOrderBody;
    const { data, error, response } = await createApiClient(accessToken).POST(
      '/api/v1/orders/price-quote',
      { body },
    );
    return responseFromApi(response, data ?? error);
  } catch {
    return Response.json({ message: 'Checkout quote is unavailable.' }, { status: 502 });
  }
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

export async function getAvailablePaymentGateways(): Promise<Response> {
  const accessToken = await getSessionToken();
  if (!accessToken) return authenticationRequired();

  try {
    return await forwardAuthenticatedResponse('/api/v1/payments/gateways', accessToken);
  } catch {
    return Response.json({ message: 'Payment service is unavailable.' }, { status: 502 });
  }
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

export async function forwardWalletRequest(
  request: Request,
  resource: 'balance' | 'ledger' | 'estimate' | 'notifications',
) {
  const accessToken = await getSessionToken();
  if (!accessToken) {
    return Response.json(null, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }
  const page = new URL(request.url).searchParams.get('page') ?? '1';
  const path =
    resource === 'estimate'
      ? '/api/v1/orders/wallet-estimate'
      : resource === 'ledger'
        ? `/api/v1/wallet/ledger?page=${encodeURIComponent(page)}`
        : resource === 'notifications'
          ? '/api/v1/notifications/wallet'
          : '/api/v1/wallet';
  try {
    const method =
      resource === 'estimate'
        ? 'POST'
        : resource === 'notifications' && request.method === 'PATCH'
          ? 'PATCH'
          : null;
    if (
      method === 'PATCH' &&
      !request.headers.get('content-type')?.startsWith('application/json')
    ) {
      return Response.json(null, { status: 415, headers: { 'Cache-Control': 'no-store' } });
    }
    const init = method
      ? {
          method,
          body: await request.text(),
          headers: { 'Content-Type': 'application/json' },
        }
      : {};
    return await forwardAuthenticatedResponse(path, accessToken, {
      ...init,
      signal: request.signal,
    });
  } catch {
    return Response.json(null, { status: 502, headers: { 'Cache-Control': 'no-store' } });
  }
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
