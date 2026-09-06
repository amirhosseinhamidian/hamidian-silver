import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RetryOrderPaymentButton } from '@/components/account/retry-order-payment-button';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  vi.stubGlobal('crypto', { randomUUID: () => 'payment-key-1' });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('RetryOrderPaymentButton', () => {
  it('starts a fresh payment attempt and redirects to a validated gateway URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        attemptId: 'attempt-1',
        status: 'REDIRECTED',
        paymentUrl: 'https://gateway.example/start/1',
      }),
    );
    const redirectToPayment = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    render(
      <RetryOrderPaymentButton
        orderId="order-1"
        reservationExpiresAt="2999-09-06T13:00:00.000Z"
        redirectToPayment={redirectToPayment}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'پرداخت سفارش' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/api/checkout/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: 'order-1', idempotencyKey: 'payment-key-1' }),
      }),
    );
    expect(redirectToPayment).toHaveBeenCalledWith('https://gateway.example/start/1');
  });

  it('does not offer payment after the inventory reservation expires', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    render(
      <RetryOrderPaymentButton orderId="order-1" reservationExpiresAt="2000-09-06T11:59:00.000Z" />,
    );

    expect(await screen.findByText(/مهلت پرداخت این سفارش به پایان رسیده/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'پرداخت سفارش' })).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows the API error and keeps the customer on the order page', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(jsonResponse({ message: 'امکان پرداخت این سفارش وجود ندارد.' }, 409)),
    );

    render(
      <RetryOrderPaymentButton orderId="order-1" reservationExpiresAt="2999-09-06T13:00:00.000Z" />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'پرداخت سفارش' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'امکان پرداخت این سفارش وجود ندارد.',
    );
  });
});
