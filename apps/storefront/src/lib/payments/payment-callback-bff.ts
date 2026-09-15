import { normalizeApiOrigin } from '@/lib/api/server-client';

type PaymentCallbackPayload = Readonly<{
  success?: boolean;
  orderId?: string;
  reconciliationRequired?: boolean;
  reconciled?: boolean;
}>;

type PaymentResultStatus = 'success' | 'pending' | 'failed';

const GENERIC_QUERY_KEYS = ['authority', 'Authority', 'status', 'Status'] as const;
const ZIBAL_QUERY_KEYS = ['trackId', 'status'] as const;
const MELLAT_BODY_KEYS = ['RefId', 'ResCode', 'SaleOrderId', 'SaleReferenceId'] as const;

function paymentApiOrigin(): string {
  const apiOrigin = process.env.HAMIDIAN_API_ORIGIN;
  if (!apiOrigin) throw new Error('HAMIDIAN_API_ORIGIN is required for payment callbacks.');
  return normalizeApiOrigin(apiOrigin);
}

async function readCallbackPayload(response: Response): Promise<PaymentCallbackPayload | null> {
  try {
    const payload = (await response.json()) as PaymentCallbackPayload;
    return payload && typeof payload === 'object' ? payload : null;
  } catch {
    return null;
  }
}

function callbackResultStatus(
  response: Response,
  payload: PaymentCallbackPayload | null,
): PaymentResultStatus {
  if (!response.ok) return response.status >= 500 ? 'pending' : 'failed';
  if (payload?.reconciliationRequired || payload?.reconciled) return 'pending';
  return payload?.success ? 'success' : 'pending';
}

function resultRedirect(request: Request, status: PaymentResultStatus, orderId?: string): Response {
  const resultUrl = new URL('/payment/result', request.url);
  resultUrl.searchParams.set('status', status);
  if (orderId) resultUrl.searchParams.set('orderId', orderId);
  return Response.redirect(resultUrl, 303);
}

async function forwardGetCallback(
  request: Request,
  attemptId: string,
  suffix: '' | '/zibal',
  allowedQueryKeys: readonly string[],
): Promise<Response> {
  const incomingUrl = new URL(request.url);
  const upstreamUrl = new URL(
    `/api/v1/payments/callback/${encodeURIComponent(attemptId)}${suffix}`,
    paymentApiOrigin(),
  );

  for (const key of allowedQueryKeys) {
    const value = incomingUrl.searchParams.get(key);
    if (value !== null) upstreamUrl.searchParams.set(key, value);
  }

  try {
    const response = await fetch(upstreamUrl, { cache: 'no-store' });
    const payload = await readCallbackPayload(response);
    return resultRedirect(
      request,
      callbackResultStatus(response, payload),
      typeof payload?.orderId === 'string' ? payload.orderId : undefined,
    );
  } catch {
    return resultRedirect(request, 'pending');
  }
}

export function handleGenericPaymentCallback(request: Request, attemptId: string) {
  return forwardGetCallback(request, attemptId, '', GENERIC_QUERY_KEYS);
}

export function handleZibalPaymentCallback(request: Request, attemptId: string) {
  return forwardGetCallback(request, attemptId, '/zibal', ZIBAL_QUERY_KEYS);
}

export async function handleMellatPaymentCallback(
  request: Request,
  attemptId: string,
): Promise<Response> {
  const upstreamUrl = new URL(
    `/api/v1/payments/callback/${encodeURIComponent(attemptId)}/mellat`,
    paymentApiOrigin(),
  );

  try {
    const formData = await request.formData();
    const body = Object.fromEntries(
      MELLAT_BODY_KEYS.flatMap((key) => {
        const value = formData.get(key);
        return typeof value === 'string' ? [[key, value] as const] : [];
      }),
    );
    const response = await fetch(upstreamUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    const payload = await readCallbackPayload(response);
    return resultRedirect(
      request,
      callbackResultStatus(response, payload),
      typeof payload?.orderId === 'string' ? payload.orderId : undefined,
    );
  } catch {
    return resultRedirect(request, 'pending');
  }
}

export async function proxyMellatPaymentRedirect(attemptId: string): Promise<Response> {
  const upstreamUrl = new URL(
    `/api/v1/payments/redirect/${encodeURIComponent(attemptId)}/mellat`,
    paymentApiOrigin(),
  );
  const response = await fetch(upstreamUrl, { cache: 'no-store', redirect: 'manual' });

  return new Response(response.body, {
    status: response.status,
    headers: {
      'Content-Type': response.headers.get('Content-Type') ?? 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
