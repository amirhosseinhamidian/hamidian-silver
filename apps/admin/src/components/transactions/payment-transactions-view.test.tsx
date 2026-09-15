import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PaymentTransactionsView } from '@/components/transactions/payment-transactions-view';
import type { AdminPaymentAttemptPage } from '@/lib/transactions/payment-transactions-model';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const baseAttempt = {
  id: 'attempt-1',
  provider: 'zarinpal',
  status: 'VERIFIED' as const,
  amountToman: 1_250_000,
  authority: 'AUTH-1',
  providerReference: 'REF-1',
  failureCode: null,
  failureMessage: null,
  verifiedAt: '2026-09-08T09:01:00.000Z',
  initiationRecoveryResolution: null,
  initiationRecoveryNote: null,
  initiationRecoveryResolvedAt: null,
  initiationRecoveryResolvedBy: null,
  reconciliation: null,
  payment: {
    id: 'payment-1',
    status: 'PAID',
    amountToman: 1_250_000,
    refundedAmountToman: 0,
    paidAt: '2026-09-08T09:01:00.000Z',
    order: {
      id: 'order-1',
      orderNumber: 'HS-1042',
      status: 'PAID',
      grandTotalToman: 1_250_000,
      user: {
        id: 'user-1',
        phone: '+989121234567',
        firstName: 'امیرحسین',
        lastName: 'حمیدیان',
      },
    },
  },
  createdAt: '2026-09-08T09:00:00.000Z',
  updatedAt: '2026-09-08T09:01:00.000Z',
};

const page: AdminPaymentAttemptPage = {
  items: [
    baseAttempt,
    {
      ...baseAttempt,
      id: 'attempt-2',
      provider: 'zibal',
      status: 'FAILED',
      authority: null,
      providerReference: null,
      failureCode: '-102',
      failureMessage: 'درگاه پاسخ معتبر نداد',
      verifiedAt: null,
      payment: {
        ...baseAttempt.payment,
        id: 'payment-2',
        status: 'PENDING',
        paidAt: null,
        order: {
          ...baseAttempt.payment.order,
          id: 'order-2',
          orderNumber: 'HS-1043',
          status: 'PENDING_PAYMENT',
          user: {
            id: 'user-2',
            phone: '+989351112233',
            firstName: 'سارا',
            lastName: 'احمدی',
          },
        },
      },
    },
  ],
  page: 1,
  pageSize: 100,
  total: 2,
  pageCount: 1,
  summary: {
    totalAmountToman: 2_500_000,
    byStatus: { VERIFIED: 1, FAILED: 1 },
    byProvider: { zarinpal: 1, zibal: 1 },
  },
};

describe('PaymentTransactionsView', () => {
  it('renders KPIs, status chart, desktop data and compact mobile cards', () => {
    render(<PaymentTransactionsView initialPage={page} failed={false} />);

    expect(screen.getByRole('img', { name: /توزیع وضعیت تراکنش‌ها/ })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'کارت‌های تراکنش پرداخت' })).toHaveClass('md:hidden');
    expect(screen.getAllByText('۱٬۲۵۰٬۰۰۰ تومان').length).toBeGreaterThan(0);
    expect(screen.getAllByText('تأییدشده').length).toBeGreaterThan(0);
    expect(screen.getAllByText('ناموفق').length).toBeGreaterThan(0);
  });

  it('searches with Persian digits and shows gateway failure evidence', () => {
    render(<PaymentTransactionsView initialPage={page} failed={false} />);
    fireEvent.change(screen.getByRole('searchbox', { name: 'جستجوی تراکنش' }), {
      target: { value: '۱۰۴۳' },
    });

    const mobileCards = screen.getByRole('region', { name: 'کارت‌های تراکنش پرداخت' });
    expect(within(mobileCards).queryByText('HS-1042')).not.toBeInTheDocument();
    expect(within(mobileCards).getByText('HS-۱۰۴۳')).toBeInTheDocument();

    fireEvent.click(within(mobileCards).getByRole('button', { name: 'مشاهده جزئیات و عملیات' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('درگاه پاسخ معتبر نداد');
    expect(screen.getByRole('dialog')).toHaveTextContent('کد خطا: -۱۰۲');
  });

  it('shows a dedicated service failure state', () => {
    render(<PaymentTransactionsView initialPage={null} failed />);
    expect(screen.getByRole('alert')).toHaveTextContent('دریافت تراکنش‌ها ناموفق بود');
  });
});
