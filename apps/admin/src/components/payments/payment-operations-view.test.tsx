import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PaymentOperationsView } from '@/components/payments/payment-operations-view';
import type {
  PaymentInitiationCandidate,
  PaymentOperationsSummary,
  PaymentReconciliation,
} from '@/lib/payments/payment-operations-model';

const { refreshMock } = vi.hoisted(() => ({ refreshMock: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: refreshMock }) }));

const summary: PaymentOperationsSummary = {
  generatedAt: '2026-09-07T12:00:00.000Z',
  stuckInitiations: 1,
  openReconciliations: 1,
  escalatedInitiations: 1,
  escalatedReconciliations: 1,
  byProvider: { stuckInitiations: { zarinpal: 1 }, openReconciliations: { zarinpal: 1 } },
};

const initiation: PaymentInitiationCandidate = {
  id: 'attempt-1',
  provider: 'zarinpal',
  amountToman: 2_500_000,
  createdAt: '2026-09-07T10:00:00.000Z',
  updatedAt: '2026-09-07T10:00:00.000Z',
  payment: {
    id: 'payment-1',
    status: 'PENDING',
    amountToman: 2_500_000,
    order: {
      id: 'order-1',
      orderNumber: 'HS-1701',
      status: 'PENDING_PAYMENT',
      grandTotalToman: 2_500_000,
      reservationExpiresAt: '2026-09-07T10:15:00.000Z',
    },
  },
};

const reconciliation: PaymentReconciliation = {
  id: 'reconciliation-1',
  provider: 'zarinpal',
  providerReference: 'REF-1701',
  amountToman: 2_500_000,
  detectedOrderStatus: 'EXPIRED',
  reason: 'پرداخت پس از انقضا تأیید شد',
  status: 'OPEN',
  resolution: null,
  externalReference: null,
  resolutionNote: null,
  resolvedAt: null,
  resolvedBy: null,
  createdAt: '2026-09-07T10:00:00.000Z',
  updatedAt: '2026-09-07T10:00:00.000Z',
  paymentAttempt: {
    id: 'attempt-2',
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
};

function view(canWrite = true) {
  return (
    <PaymentOperationsView
      summary={summary}
      initiations={[initiation]}
      reconciliations={[reconciliation]}
      failed={false}
      canWrite={canWrite}
    />
  );
}

describe('PaymentOperationsView', () => {
  beforeEach(() => {
    refreshMock.mockReset();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('shows Persian operational KPIs and both queues', () => {
    render(view());
    expect(screen.getByRole('region', { name: 'شاخص‌های عملیات پرداخت' })).toHaveTextContent(
      'شروع پرداخت نامشخص',
    );
    expect(screen.getByRole('tab', { name: 'شروع نامشخص (۱)' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    fireEvent.click(screen.getByRole('tab', { name: 'مغایرت باز (۱)' }));
    expect(screen.getAllByText('REF-۱۷۰۱').length).toBeGreaterThan(0);
  });

  it('does not expose mutation actions to a read-only finance operator', () => {
    render(view(false));
    expect(screen.getByText(/دسترسی شما فقط برای مشاهده است/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'بازیابی هدایت' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'مختومه' })).not.toBeInTheDocument();
  });

  it('requires review evidence and resolves an external refund through the BFF', async () => {
    const fetchMock = vi.mocked(fetch).mockResolvedValue(new Response('{}', { status: 200 }));
    render(view());
    fireEvent.click(screen.getByRole('tab', { name: 'مغایرت باز (۱)' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'ثبت بازپرداخت خارجی' })[0]);
    fireEvent.change(screen.getByLabelText(/مرجع بازپرداخت خارجی/), { target: { value: '۱۲۳۴۵' } });
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
});
