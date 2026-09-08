import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PaymentReconciliationView } from '@/components/payments/payment-reconciliation-view';
import type { PaymentReconciliation } from '@/lib/payments/payment-operations-model';

const { refreshMock } = vi.hoisted(() => ({ refreshMock: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: refreshMock }) }));

function reconciliation(overrides: Partial<PaymentReconciliation> = {}): PaymentReconciliation {
  return {
    id: 'reconciliation-1',
    provider: 'zarinpal',
    providerReference: 'REF-1701',
    amountToman: 2_500_000,
    detectedOrderStatus: 'EXPIRED',
    reason: 'پرداخت پس از انقضای سفارش تأیید شد',
    status: 'OPEN',
    resolution: null,
    externalReference: null,
    resolutionNote: null,
    resolvedAt: null,
    resolvedBy: null,
    createdAt: '2026-09-07T10:00:00.000Z',
    updatedAt: '2026-09-07T10:00:00.000Z',
    paymentAttempt: {
      id: 'attempt-1',
      provider: 'zarinpal',
      authority: 'A-1701',
      providerReference: 'REF-1701',
      amountToman: 2_500_000,
      status: 'RECONCILIATION_REQUIRED',
      verifiedAt: null,
      payment: {
        id: 'payment-1',
        status: 'RECONCILIATION_REQUIRED',
        amountToman: 2_500_000,
        order: { id: 'order-1', orderNumber: 'HS-1701', status: 'EXPIRED' },
      },
    },
    ...overrides,
  };
}

const resolved = reconciliation({
  id: 'reconciliation-2',
  provider: 'zibal',
  providerReference: 'REF-1702',
  status: 'RESOLVED',
  resolution: 'REFUNDED_EXTERNALLY',
  externalReference: 'RETURN-22',
  resolutionNote: 'بازپرداخت در پنل درگاه تطبیق داده شد',
  resolvedAt: '2026-09-07T11:00:00.000Z',
  resolvedBy: {
    id: 'admin-1',
    phone: '09121234567',
    firstName: 'مدیر',
    lastName: 'مالی',
  },
  paymentAttempt: {
    ...reconciliation().paymentAttempt,
    id: 'attempt-2',
    provider: 'zibal',
    providerReference: 'REF-1702',
    status: 'RECONCILED',
    payment: {
      ...reconciliation().paymentAttempt.payment,
      id: 'payment-2',
      status: 'REFUNDED',
      order: { id: 'order-2', orderNumber: 'HS-1702', status: 'EXPIRED' },
    },
  },
});

describe('PaymentReconciliationView', () => {
  beforeEach(() => {
    refreshMock.mockReset();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('shows the independent queue, KPIs and resolved audit details', () => {
    render(
      <PaymentReconciliationView
        reconciliations={[reconciliation(), resolved]}
        failed={false}
        canWrite
      />,
    );

    expect(screen.getByRole('region', { name: 'شاخص‌های مغایرت پرداخت' })).toHaveTextContent(
      'کل مغایرت‌ها۲',
    );
    expect(screen.getByRole('img', { name: /توزیع وضعیت مغایرت‌ها؛ مجموع ۲/ })).toBeInTheDocument();

    const detailButtons = screen.getAllByRole('button', { name: 'جزئیات' });
    fireEvent.click(detailButtons[1]);
    expect(screen.getByText('سابقه رفع مغایرت')).toBeInTheDocument();
    expect(screen.getByText('RETURN-۲۲')).toBeInTheDocument();
    expect(screen.getByText('مدیر مالی')).toBeInTheDocument();
  });

  it('normalizes Persian digits and resolves only through the controlled BFF', async () => {
    const fetchMock = vi.mocked(fetch).mockResolvedValue(new Response('{}', { status: 200 }));
    render(
      <PaymentReconciliationView reconciliations={[reconciliation()]} failed={false} canWrite />,
    );

    fireEvent.click(screen.getAllByRole('button', { name: 'رفع مغایرت' })[0]);
    fireEvent.change(screen.getByLabelText(/مرجع بازپرداخت خارجی/), {
      target: { value: '۱۲۳۴۵' },
    });
    fireEvent.change(screen.getByLabelText(/یادداشت بررسی/), {
      target: { value: 'بازپرداخت در پنل درگاه تأیید شد' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'تأیید نهایی' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/payments/reconciliations/reconciliation-1/resolve-external-refund',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({
          externalRefundReference: '12345',
          resolutionNote: 'بازپرداخت در پنل درگاه تأیید شد',
        }),
      }),
    );
    expect(refreshMock).toHaveBeenCalledOnce();
  });

  it('keeps mutation controls hidden from read-only finance users', () => {
    render(
      <PaymentReconciliationView
        reconciliations={[reconciliation()]}
        failed={false}
        canWrite={false}
      />,
    );

    expect(screen.getByText(/دسترسی شما فقط برای مشاهده است/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'رفع مغایرت' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'جزئیات' })).toHaveLength(1);
  });
});
