import { afterEach, describe, expect, it, vi } from 'vitest';

import { initiateCheckoutPayment } from '@/lib/checkout/bff';

const { cookies } = vi.hoisted(() => ({ cookies: vi.fn() }));

vi.mock('next/headers', () => ({ cookies }));

describe('checkout payment BFF', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    delete process.env.HAMIDIAN_API_ORIGIN;
  });

  it('forwards authenticated IranDargah initiation to the API', async () => {
    process.env.HAMIDIAN_API_ORIGIN = 'https://api.example.com';
    cookies.mockResolvedValue({
      get: () => ({ value: 'session-token' }),
    });
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json(
        {
          paymentUrl: 'https://ipg.irandargah.com/startpay/AUTH123',
          authority: 'AUTH123',
        },
        { status: 201 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await initiateCheckoutPayment(
      new Request('https://hamidian.shop/api/checkout/payment', {
        method: 'POST',
        body: JSON.stringify({
          orderId: '20000000-0000-4000-8000-000000000001',
          idempotencyKey: 'checkout-irandargah-001',
          provider: 'irandargah',
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual(expect.objectContaining({ authority: 'AUTH123' }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
