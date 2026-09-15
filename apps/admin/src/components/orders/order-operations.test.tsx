import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OrderOperations } from '@/components/orders/order-operations';
import type { AdminOrder } from '@/lib/orders/orders-model';

const { refreshMock } = vi.hoisted(() => ({ refreshMock: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

function makeOrder(overrides: Partial<AdminOrder> = {}): AdminOrder {
  return {
    id: 'order-1',
    orderNumber: 'HS-1234',
    status: 'PAID',
    merchandiseTotalToman: 1_000_000,
    platingTotalToman: 0,
    discountTotalToman: 0,
    shippingTotalToman: 80_000,
    taxTotalToman: 0,
    grandTotalToman: 1_080_000,
    reservationExpiresAt: '2026-09-07T12:15:00.000Z',
    paidAt: '2026-09-07T12:05:00.000Z',
    cancelledAt: null,
    deliveredAt: null,
    returnAuthorization: null,
    createdAt: '2026-09-07T12:00:00.000Z',
    updatedAt: '2026-09-07T12:05:00.000Z',
    customer: { id: 'user-1', name: 'علی رضایی', phone: '09121234567' },
    address: null,
    items: [],
    payment: {
      id: 'payment-1',
      status: 'PAID',
      amountToman: 1_080_000,
      refundedAmountToman: 0,
      paidAt: '2026-09-07T12:05:00.000Z',
      updatedAt: '2026-09-07T12:05:00.000Z',
      attempts: [],
    },
    shipment: null,
    timeline: [],
    ...overrides,
  };
}

describe('OrderOperations', () => {
  beforeEach(() => {
    refreshMock.mockReset();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('confirms an allowed status transition and refreshes server data', async () => {
    const fetchMock = vi
      .mocked(fetch)
      .mockResolvedValue(new Response(JSON.stringify({ status: 'PROCESSING' }), { status: 200 }));

    render(<OrderOperations order={makeOrder()} canUpdateStatus canCancel={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'شروع پردازش سفارش' }));
    fireEvent.change(screen.getByLabelText('یادداشت تغییر وضعیت'), {
      target: { value: 'پرداخت بررسی شد' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'تأیید تغییر وضعیت' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledWith('/api/orders/order-1/status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'PROCESSING', reason: 'پرداخت بررسی شد' }),
    });
    expect(refreshMock).toHaveBeenCalledOnce();
  });

  it('does not expose privileged actions to a read-only operator', () => {
    const { container } = render(
      <OrderOperations order={makeOrder()} canUpdateStatus={false} canCancel={false} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('requires a reason before privileged cancellation', async () => {
    const fetchMock = vi.mocked(fetch).mockResolvedValue(new Response('{}', { status: 201 }));
    const pendingOrder = makeOrder({
      status: 'PENDING_PAYMENT',
      payment: null,
      paidAt: null,
    });

    render(<OrderOperations order={pendingOrder} canUpdateStatus={false} canCancel />);
    fireEvent.click(screen.getByRole('button', { name: 'لغو سفارش' }));
    fireEvent.click(screen.getByRole('button', { name: 'تأیید لغو سفارش' }));
    expect(screen.getByText('دلیل عملیات باید حداقل ۳ نویسه باشد.')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/دلیل عملیات/), {
      target: { value: 'ثبت سفارش تکراری' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'تأیید لغو سفارش' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledWith('/api/orders/order-1/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'ثبت سفارش تکراری' }),
    });
  });

  it('gates exceptional return authorization behind confirmation and a review reason', async () => {
    const fetchMock = vi.mocked(fetch).mockResolvedValue(new Response('{}', { status: 200 }));
    const deliveredOrder = makeOrder({
      status: 'DELIVERED',
      deliveredAt: '2026-09-08T12:00:00.000Z',
      shipment: {
        id: 'shipment-1',
        provider: 'POSTEX',
        serviceCode: 'EXPRESS',
        serviceName: 'پست پیشتاز',
        status: 'DELIVERED',
        providerCreationState: 'CREATED',
        shippingCostToman: 80_000,
        totalWeightGrams: 12.5,
        estimatedDeliveryDays: 3,
        providerShipmentId: 'provider-shipment-1',
        trackingCode: 'TRACK-123',
        shippedAt: '2026-09-07T15:00:00.000Z',
        deliveredAt: '2026-09-08T12:00:00.000Z',
        createdAt: '2026-09-07T14:00:00.000Z',
        updatedAt: '2026-09-08T12:00:00.000Z',
        timeline: [],
      },
    });

    render(<OrderOperations order={deliveredOrder} canUpdateStatus canCancel={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'بررسی و فعال‌کردن مجوز' }));
    expect(screen.getByText(/پسند نکردن محصول دلیل قابل‌قبول/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/دلیل عملیات/), {
      target: { value: 'ارسال کالای اشتباه تأیید شد' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'تأیید مجوز مرجوعی' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledWith('/api/orders/order-1/return-authorization', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'ارسال کالای اشتباه تأیید شد' }),
    });
  });
});
