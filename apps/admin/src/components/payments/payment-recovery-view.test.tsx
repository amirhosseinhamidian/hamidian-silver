import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PaymentRecoveryView } from '@/components/payments/payment-recovery-view';
import type {
  PaymentInitiationCandidate,
  PaymentOperationsSummary,
} from '@/lib/payments/payment-operations-model';
import type { AdminPaymentAttempt } from '@/lib/transactions/payment-transactions-model';

const { refreshMock } = vi.hoisted(() => ({ refreshMock: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: refreshMock }) }));

const summary: PaymentOperationsSummary = {
  generatedAt: '2026-09-08T12:00:00.000Z',
  stuckInitiations: 2,
  openReconciliations: 0,
  escalatedInitiations: 1,
  escalatedReconciliations: 0,
  byProvider: {
    stuckInitiations: { zarinpal: 1, zibal: 1 },
    openReconciliations: {},
  },
};

const candidate: PaymentInitiationCandidate = {
  id: 'attempt-1',
  provider: 'zarinpal',
  amountToman: 2_500_000,
  createdAt: '2026-09-08T10:00:00.000Z',
  updatedAt: '2026-09-08T10:00:00.000Z',
  payment: {
    id: 'payment-1',
    status: 'PENDING',
    amountToman: 2_500_000,
    order: {
      id: 'order-1',
      orderNumber: 'HS-2201',
      status: 'PENDING_PAYMENT',
      grandTotalToman: 2_500_000,
      reservationExpiresAt: '2099-09-08T13:00:00.000Z',
    },
  },
};

const history: AdminPaymentAttempt = {
  id: 'attempt-2',
  provider: 'zibal',
  status: 'FAILED',
  amountToman: 1_800_000,
  authority: null,
  providerReference: null,
  failureCode: 'INITIATION_RECOVERY_ABANDONED',
  failureMessage: 'Manager abandoned an unknown payment initiation after provider review.',
  verifiedAt: null,
  initiationRecoveryResolution: 'ABANDONED',
  initiationRecoveryNote: 'در پنل درگاه تراکنشی ساخته نشده بود',
  initiationRecoveryResolvedAt: '2026-09-08T11:00:00.000Z',
  initiationRecoveryResolvedBy: {
    id: 'admin-1',
    phone: '09121234567',
    firstName: 'مدیر',
    lastName: 'مالی',
  },
  reconciliation: null,
  payment: {
    id: 'payment-2',
    status: 'CANCELLED',
    amountToman: 1_800_000,
    refundedAmountToman: 0,
    paidAt: null,
    order: {
      id: 'order-2',
      orderNumber: 'HS-2202',
      status: 'EXPIRED',
      grandTotalToman: 1_800_000,
      user: {
        id: 'user-1',
        phone: '09351112233',
        firstName: 'سارا',
        lastName: 'احمدی',
      },
    },
  },
  createdAt: '2026-09-08T09:00:00.000Z',
  updatedAt: '2026-09-08T11:00:00.000Z',
};

function view(canWrite = true) {
  return (
    <PaymentRecoveryView
      summary={summary}
      candidates={[candidate]}
      history={[history]}
      failed={false}
      canWrite={canWrite}
    />
  );
}

describe('PaymentRecoveryView', () => {
  beforeEach(() => {
    refreshMock.mockReset();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('shows the isolated recovery queue, safety policy and operator history', () => {
    render(view());

    expect(screen.getByRole('region', { name: 'شاخص‌های بازیابی پرداخت' })).toHaveTextContent(
      'صف فعال۱',
    );
    expect(screen.getByText('پرداخت نامشخص را دستی تأیید یا تکرار نکنید')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'کارت‌های صف فعال بازیابی' })).toHaveClass(
      'md:hidden',
    );

    fireEvent.click(screen.getByRole('tab', { name: 'سابقه عملیات (۱)' }));
    expect(screen.getByRole('region', { name: 'کارت‌های سابقه بازیابی' })).toHaveClass('md:hidden');
    expect(screen.getAllByText('مدیر مالی').length).toBeGreaterThan(0);
    expect(screen.getAllByText('مختومه شد').length).toBeGreaterThan(0);
  });

  it('normalizes provider evidence and restores a valid redirect through the BFF', async () => {
    const fetchMock = vi.mocked(fetch).mockResolvedValue(new Response('{}', { status: 200 }));
    render(view());

    fireEvent.click(screen.getAllByRole('button', { name: 'بازیابی هدایت' })[0]);
    fireEvent.change(screen.getByLabelText(/شناسه Authority/), {
      target: { value: '۱۲۳۴۵' },
    });
    fireEvent.change(screen.getByLabelText(/نشانی پرداخت/), {
      target: { value: 'https://sandbox.zarinpal.com/pg/StartPay/12345' },
    });
    fireEvent.change(screen.getByLabelText(/یادداشت بررسی/), {
      target: { value: 'پاسخ initiation در پنل درگاه تأیید شد' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'تأیید نهایی' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/payments/initiation-recovery/attempt-1/resolve',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({
          resolution: 'REDIRECTED',
          note: 'پاسخ initiation در پنل درگاه تأیید شد',
          authority: '12345',
          paymentUrl: 'https://sandbox.zarinpal.com/pg/StartPay/12345',
        }),
      }),
    );
    expect(refreshMock).toHaveBeenCalledOnce();
  });

  it('keeps recovery mutations hidden for read-only finance users', () => {
    render(view(false));

    expect(screen.getByText(/دسترسی شما فقط برای مشاهده است/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'بازیابی هدایت' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'مختومه‌کردن' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'جزئیات' })).toHaveLength(1);
  });
});
