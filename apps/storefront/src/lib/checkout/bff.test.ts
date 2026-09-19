import { describe, expect, it, vi } from 'vitest';

import { initiateCheckoutPayment } from '@/lib/checkout/bff';

const { cookies } = vi.hoisted(() => ({ cookies: vi.fn() }));

vi.mock('next/headers', () => ({ cookies }));

describe('checkout payment BFF', () => {
  it('keeps bank-gateway initiation unavailable while licensing is pending', async () => {
    const response = await initiateCheckoutPayment(
      new Request('https://hamidian.shop/api/checkout/payment', {
        method: 'POST',
        body: JSON.stringify({
          orderId: '20000000-0000-4000-8000-000000000001',
          idempotencyKey: 'checkout-disabled-gateway',
        }),
      }),
    );

    expect(response.status).toBe(404);
    expect(await response.text()).toBe('');
    expect(cookies).not.toHaveBeenCalled();
  });
});
