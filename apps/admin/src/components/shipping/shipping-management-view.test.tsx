import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ShippingManagementView } from './shipping-management-view';
import type { AdminOrder } from '@/lib/orders/orders-model';

const { refreshMock } = vi.hoisted(() => ({ refreshMock: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: refreshMock }) }));

function order(shipment: AdminOrder['shipment'] = null): AdminOrder {
  return {
    id: 'order-1',
    orderNumber: 'HS-1701',
    status: 'PROCESSING',
    merchandiseTotalToman: 2_500_000,
    platingTotalToman: 0,
    discountTotalToman: 0,
    shippingTotalToman: 0,
    taxTotalToman: 0,
    grandTotalToman: 2_500_000,
    reservationExpiresAt: '2026-09-07T12:15:00.000Z',
    paidAt: '2026-09-07T12:05:00.000Z',
    cancelledAt: null,
    deliveredAt: null,
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
      amountToman: 2_500_000,
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
  shippingCostToman: 0,
  totalWeightGrams: 8.5,
  estimatedDeliveryDays: 3,
  providerShipmentId: 'manual:order-1',
  trackingCode: null,
  shippedAt: null,
  deliveredAt: null,
  createdAt: '2026-09-07T13:00:00.000Z',
  updatedAt: '2026-09-07T13:00:00.000Z',
  timeline: [
    {
      id: 'history-1',
      fromStatus: null,
      toStatus: 'READY',
      reason: 'آماده شد',
      actor: 'مدیر ارسال',
      createdAt: '2026-09-07T13:00:00.000Z',
    },
  ],
};

describe('ShippingManagementView', () => {
  beforeEach(() => {
    refreshMock.mockReset();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('shows the manual policy and responsive shipping queue', () => {
    render(<ShippingManagementView orders={[order()]} failed={false} canCreate canUpdateStatus />);
    expect(screen.getByText('ارسال دستی بدون Postex')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'کارت‌های مدیریت ارسال' })).toHaveClass('md:hidden');
  });

  it('creates a shipment without a provider quote', async () => {
    const fetchMock = vi.mocked(fetch).mockResolvedValue(new Response('{}', { status: 201 }));
    render(<ShippingManagementView orders={[order()]} failed={false} canCreate canUpdateStatus />);
    fireEvent.click(screen.getAllByRole('button', { name: 'ساخت مرسوله دستی' })[0]);
    fireEvent.change(screen.getByLabelText(/یادداشت عملیات/), {
      target: { value: 'بسته آماده تحویل است' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'تأیید نهایی' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/shipping/orders/order-1/manual',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          serviceName: 'ارسال استاندارد',
          estimatedDeliveryDays: 3,
          reason: 'بسته آماده تحویل است',
        }),
      }),
    );
  });

  it('requires and normalizes tracking before handoff', async () => {
    const fetchMock = vi.mocked(fetch).mockResolvedValue(new Response('{}', { status: 200 }));
    render(
      <ShippingManagementView
        orders={[order(readyShipment)]}
        failed={false}
        canCreate
        canUpdateStatus
      />,
    );
    fireEvent.click(screen.getAllByRole('button', { name: 'تحویل به پست' })[0]);
    fireEvent.change(screen.getByLabelText(/یادداشت عملیات/), {
      target: { value: 'تحویل به باجه پست' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'تأیید نهایی' }));
    expect(screen.getByText(/ثبت کد رهگیری پیش از تحویل/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/کد رهگیری/), { target: { value: '۱۲۳۴۵۶' } });
    fireEvent.click(screen.getByRole('button', { name: 'تأیید نهایی' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/shipping/orders/order-1/status',
      expect.objectContaining({
        body: JSON.stringify({
          status: 'HANDED_OVER',
          reason: 'تحویل به باجه پست',
          trackingCode: '123456',
        }),
      }),
    );
  });
});
