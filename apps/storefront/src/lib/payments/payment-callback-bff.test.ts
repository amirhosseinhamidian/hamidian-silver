import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  handleGenericPaymentCallback,
  handleMellatPaymentCallback,
} from '@/lib/payments/payment-callback-bff';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('payment callback BFF', () => {
  it('forwards only supported gateway query values and returns to a successful result', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ success: true, orderId: 'order-1' }));
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('HAMIDIAN_API_ORIGIN', 'https://api.example');

    const response = await handleGenericPaymentCallback(
      new Request(
        'https://shop.example/api/payment/callback/attempt-1?Authority=AUTH-1&Status=OK&ignored=value',
      ),
      'attempt-1',
    );

    expect(fetchMock).toHaveBeenCalledWith(
      new URL('https://api.example/api/v1/payments/callback/attempt-1?Authority=AUTH-1&Status=OK'),
      { cache: 'no-store' },
    );
    expect(response.status).toBe(303);
    expect(response.headers.get('Location')).toBe(
      'https://shop.example/payment/result?status=success&orderId=order-1',
    );
  });

  it('uses a pending result when gateway verification has an uncertain server outcome', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, 503)));
    vi.stubEnv('HAMIDIAN_API_ORIGIN', 'https://api.example');

    const response = await handleGenericPaymentCallback(
      new Request('https://shop.example/api/payment/callback/attempt-1?authority=AUTH-1'),
      'attempt-1',
    );

    expect(response.headers.get('Location')).toBe(
      'https://shop.example/payment/result?status=pending',
    );
  });

  it('converts the Mellat form callback to the backend JSON contract', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ success: true, reconciliationRequired: true, orderId: 'order-2' }),
      );
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('HAMIDIAN_API_ORIGIN', 'https://api.example');
    const form = new URLSearchParams({ RefId: 'REF1', ResCode: '0', ignored: 'value' });

    const response = await handleMellatPaymentCallback(
      new Request('https://shop.example/api/payment/callback/attempt-2/mellat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form,
      }),
      'attempt-2',
    );

    expect(fetchMock).toHaveBeenCalledWith(
      new URL('https://api.example/api/v1/payments/callback/attempt-2/mellat'),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ RefId: 'REF1', ResCode: '0' }),
        cache: 'no-store',
      },
    );
    expect(response.headers.get('Location')).toBe(
      'https://shop.example/payment/result?status=pending&orderId=order-2',
    );
  });
});
