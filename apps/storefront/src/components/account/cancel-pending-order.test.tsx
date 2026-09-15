import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { CustomerOrderDetail } from '@/components/account/account-types';
import { CancelPendingOrder } from '@/components/account/cancel-pending-order';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('CancelPendingOrder', () => {
  it('requires explicit confirmation before cancelling the customer order', async () => {
    const cancelledOrder = {
      id: 'order/1',
      status: 'CANCELLED',
    } as CustomerOrderDetail;
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(cancelledOrder), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const onCancelled = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    render(<CancelPendingOrder orderId="order/1" onCancelled={onCancelled} />);

    fireEvent.click(screen.getByRole('button', { name: 'لغو سفارش' }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole('group', { name: 'تأیید لغو سفارش' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'تأیید لغو سفارش' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/api/orders/order%2F1', { method: 'POST' }),
    );
    await waitFor(() => expect(onCancelled).toHaveBeenCalledWith(cancelledOrder));
  });
});
