import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { CustomerOrderDetail, CustomerOrderReturn } from '@/components/account/account-types';
import { CustomerOrderReturns } from '@/components/account/customer-order-returns';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const order = {
  id: 'order/1',
  status: 'DELIVERED',
  returnAuthorized: true,
  items: [
    {
      id: 'item-1',
      productNameSnapshot: 'انگشتر نقره مهتاب',
      returnableQuantity: 2,
    },
  ],
} as CustomerOrderDetail;

const requestedReturn: CustomerOrderReturn = {
  id: 'return/1',
  orderId: 'order/1',
  status: 'REQUESTED',
  reason: 'کالای دیگری ارسال شده است',
  receivedAt: null,
  cancelledAt: null,
  createdAt: '2026-09-06T12:00:00.000Z',
  updatedAt: '2026-09-06T12:00:00.000Z',
  items: [
    {
      id: 'return-item-1',
      orderItemId: 'item-1',
      quantity: 2,
      disposition: null,
      createdAt: '2026-09-06T12:00:00.000Z',
      updatedAt: '2026-09-06T12:00:00.000Z',
    },
  ],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('CustomerOrderReturns', () => {
  it('creates and then explicitly cancels a customer return request', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse(requestedReturn, 201))
      .mockResolvedValueOnce(
        jsonResponse({
          ...requestedReturn,
          status: 'CANCELLED',
          cancelledAt: '2026-09-06T12:05:00.000Z',
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    render(<CustomerOrderReturns order={order} />);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/api/orders/order%2F1/returns', {
        cache: 'no-store',
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'ثبت درخواست مرجوعی' }));
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'افزایش تعداد' }));
    fireEvent.change(screen.getByLabelText('دلیل مرجوعی'), {
      target: { value: 'کالای دیگری ارسال شده است' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'ارسال درخواست' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/orders/order%2F1/returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{ orderItemId: 'item-1', quantity: 2 }],
          reason: 'کالای دیگری ارسال شده است',
        }),
      }),
    );
    expect(await screen.findByText('در انتظار بررسی')).toBeInTheDocument();
    expect(screen.getByText('انگشتر نقره مهتاب · ۲ عدد')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'لغو درخواست' }));
    expect(screen.getByRole('group', { name: 'تأیید لغو درخواست مرجوعی' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'تأیید لغو' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenNthCalledWith(3, '/api/order-returns/return%2F1', {
        method: 'DELETE',
      }),
    );
    expect(await screen.findByText('لغوشده')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ثبت درخواست مرجوعی' })).toBeInTheDocument();
  });
});
