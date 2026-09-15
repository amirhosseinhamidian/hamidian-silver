import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RefundManagementView } from '@/components/refunds/refund-management-view';
import type { AdminPaymentRefund, AdminRefundOrder } from '@/lib/refunds/refunds-model';

const { refreshMock } = vi.hoisted(() => ({ refreshMock: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: refreshMock }) }));

const order: AdminRefundOrder = {
  id: 'order-1',
  orderNumber: 'HS-2101',
  status: 'DELIVERED',
  customer: {
    id: 'user-1',
    phone: '09121234567',
    firstName: 'علی',
    lastName: 'رضایی',
  },
  payment: {
    status: 'PAID',
    amountToman: 2_500_000,
    refundedAmountToman: 0,
    refundAllocatedToman: 500_000,
  },
};

const refund: AdminPaymentRefund = {
  id: 'refund-1',
  paymentId: 'payment-1',
  idempotencyKey: 'admin-refund-1',
  status: 'PENDING',
  amountToman: 500_000,
  providerSnapshot: 'zarinpal',
  originalProviderReferenceSnapshot: 'PAY-101',
  externalReference: null,
  requestNote: 'بازپرداخت موردی با تأیید مدیر',
  resolutionNote: null,
  confirmedAt: null,
  cancelledAt: null,
  createdAt: '2026-09-08T10:00:00.000Z',
  updatedAt: '2026-09-08T10:00:00.000Z',
  payment: {
    id: 'payment-1',
    orderId: 'order-1',
    status: 'PAID',
    amountToman: 2_500_000,
    refundedAmountToman: 0,
    refundAllocatedToman: 500_000,
    order: { id: 'order-1', orderNumber: 'HS-2101', status: 'DELIVERED' },
  },
  requestedBy: {
    id: 'admin-1',
    phone: '09121234567',
    firstName: 'مدیر',
    lastName: 'مالی',
  },
  confirmedBy: null,
  cancelledBy: null,
};

function view(canWrite = true) {
  return (
    <RefundManagementView refunds={[refund]} orders={[order]} failed={false} canWrite={canWrite} />
  );
}

describe('RefundManagementView', () => {
  beforeEach(() => {
    refreshMock.mockReset();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('shows operational KPIs, responsive records and the exceptional-return policy', () => {
    render(view());

    expect(screen.getByRole('region', { name: 'شاخص‌های بازپرداخت' })).toHaveTextContent(
      'در انتظار اقدام۱',
    );
    expect(
      screen.getByRole('img', { name: /توزیع وضعیت بازپرداخت‌ها؛ مجموع ۱/ }),
    ).toBeInTheDocument();
    expect(screen.getByText('بازپرداخت مالی، مجوز مرجوعی کالا نیست')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'کارت‌های بازپرداخت' })).toHaveClass('md:hidden');

    fireEvent.click(screen.getByRole('button', { name: 'درخواست بازپرداخت' }));
    expect(screen.getByText(/ظرفیت مبلغ را تا تعیین نتیجه رزرو می‌کند/)).toBeInTheDocument();
    expect(screen.getByLabelText(/سفارش/)).toBeInTheDocument();
  });

  it('confirms a pending refund with normalized gateway evidence', async () => {
    const fetchMock = vi.mocked(fetch).mockResolvedValue(new Response('{}', { status: 201 }));
    render(view());

    fireEvent.click(screen.getAllByRole('button', { name: 'تأیید نتیجه' })[0]);
    fireEvent.change(screen.getByLabelText(/مرجع بازپرداخت درگاه/), {
      target: { value: '۱۲۳۴۵' },
    });
    fireEvent.change(screen.getByLabelText(/یادداشت عملیات/), {
      target: { value: 'بازپرداخت در پنل درگاه تأیید شد' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'تأیید نهایی' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/refunds/refund-1/confirm',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          externalReference: '12345',
          note: 'بازپرداخت در پنل درگاه تأیید شد',
        }),
      }),
    );
    expect(refreshMock).toHaveBeenCalledOnce();
  });

  it('does not expose financial mutations to a read-only operator', () => {
    render(view(false));

    expect(screen.getByText(/دسترسی شما فقط برای مشاهده است/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'درخواست بازپرداخت' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'تأیید نتیجه' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'جزئیات' })).toHaveLength(1);
  });
});
