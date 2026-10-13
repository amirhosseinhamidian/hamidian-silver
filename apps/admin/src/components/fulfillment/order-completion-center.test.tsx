import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AdminOrder } from '@/lib/orders/orders-model';
import { OrderCompletionCenter } from './order-completion-center';

const { refreshMock } = vi.hoisted(() => ({ refreshMock: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: refreshMock }) }));

function order(shipment: AdminOrder['shipment'] = null): AdminOrder {
  return {
    id: 'order-1',
    orderNumber: 'HS-1701',
    customerNote: null,
    status: 'PROCESSING',
    merchandiseTotalToman: 2_500_000,
    platingTotalToman: 0,
    discountTotalToman: 0,
    shippingTotalToman: 80_000,
    taxTotalToman: 0,
    grandTotalToman: 2_580_000,
    reservationExpiresAt: '2026-09-07T12:15:00.000Z',
    paidAt: '2026-09-07T12:05:00.000Z',
    cancelledAt: null,
    deliveredAt: null,
    shippingSelection: null,
    returnAuthorization: null,
    createdAt: '2026-09-07T12:00:00.000Z',
    updatedAt: '2026-09-07T12:05:00.000Z',
    customer: { id: 'user-1', name: 'علی رضایی', phone: '09121234567' },
    address: {
      recipientName: 'علی رضایی',
      phone: '09121234567',
      province: 'تهران',
      city: 'تهران',
      addressLine: 'خیابان نمونه',
      postalCode: '1234567890',
    },
    items: [],
    payment: {
      id: 'payment-1',
      status: 'PAID',
      amountToman: 2_580_000,
      refundedAmountToman: 0,
      paidAt: '2026-09-07T12:05:00.000Z',
      updatedAt: '2026-09-07T12:05:00.000Z',
      attempts: [],
    },
    shipment,
    timeline: [],
  };
}

const readyShipment: NonNullable<AdminOrder['shipment']> = {
  id: 'shipment-1',
  provider: 'manual',
  serviceCode: 'manual-standard',
  serviceName: 'پست پیشتاز',
  status: 'READY',
  providerCreationState: 'CREATED',
  shippingCostToman: 80_000,
  totalWeightGrams: 8.5,
  estimatedDeliveryDays: 3,
  providerShipmentId: 'manual:order-1',
  trackingCode: null,
  deliveryType: 'POST',
  shippedAt: null,
  deliveredAt: null,
  createdAt: '2026-09-07T13:00:00.000Z',
  updatedAt: '2026-09-07T13:00:00.000Z',
  timeline: [],
};

function renderCenter(currentOrder: AdminOrder) {
  return render(
    <OrderCompletionCenter
      orders={[currentOrder]}
      platingOrders={[]}
      carriers={[]}
      failed={false}
      canUpdateStatus
      canCreateShipment
      canCompletePlating
    />,
  );
}

describe('OrderCompletionCenter', () => {
  beforeEach(() => {
    refreshMock.mockReset();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('creates the next shipment from the unified flow without requiring a note', async () => {
    const fetchMock = vi.mocked(fetch).mockResolvedValue(new Response('{}', { status: 201 }));
    renderCenter(order());

    fireEvent.click(screen.getAllByRole('button', { name: 'تکمیل سفارش' })[0]);
    expect(screen.getByRole('heading', { name: 'اقدام بعدی: ساخت مرسوله' })).toBeInTheDocument();
    expect(screen.getByLabelText(/یادداشت عملیات/)).not.toBeRequired();
    fireEvent.click(screen.getByRole('button', { name: 'ساخت مرسوله' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/shipping/orders/order-1/manual',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          serviceName: 'ارسال استاندارد',
          estimatedDeliveryDays: 3,
        }),
      }),
    );
    expect(refreshMock).toHaveBeenCalledOnce();
  });

  it('hands a shipment over without tracking and can suppress the customer SMS', async () => {
    const fetchMock = vi.mocked(fetch).mockResolvedValue(new Response('{}', { status: 200 }));
    renderCenter(order(readyShipment));

    fireEvent.click(screen.getAllByRole('button', { name: 'تکمیل سفارش' })[0]);
    expect(screen.getByLabelText(/کد رهگیری/)).not.toBeRequired();
    const sms = screen.getByRole('checkbox', { name: 'ارسال پیامک این مرحله به مشتری' });
    expect(sms).toBeChecked();
    fireEvent.click(sms);
    fireEvent.click(screen.getByRole('button', { name: 'تحویل مرسوله به ارسال‌کننده' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/shipping/orders/order-1/status',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ status: 'HANDED_OVER', sendCustomerSms: false }),
      }),
    );
  });
});
