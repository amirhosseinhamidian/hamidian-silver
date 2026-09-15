import { describe, expect, it } from 'vitest';

import {
  parsePaymentAttemptPage,
  paymentAttemptNeedsReview,
} from '@/lib/transactions/payment-transactions-model';

const attempt = {
  id: 'attempt-1',
  provider: 'zarinpal',
  status: 'VERIFIED',
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

describe('payment transactions model', () => {
  it('parses the paginated transaction projection', () => {
    const parsed = parsePaymentAttemptPage({
      items: [attempt],
      page: 1,
      pageSize: 50,
      total: 1,
      pageCount: 1,
      summary: {
        totalAmountToman: 1_250_000,
        byStatus: { VERIFIED: 1 },
        byProvider: { zarinpal: 1 },
      },
    });

    expect(parsed?.items[0]).toEqual(expect.objectContaining({ id: 'attempt-1' }));
    expect(parsed?.summary.byStatus.VERIFIED).toBe(1);
  });

  it('rejects malformed payment evidence and identifies stuck attempts', () => {
    expect(
      parsePaymentAttemptPage({
        items: [{ ...attempt, status: 'UNKNOWN' }],
        page: 1,
        pageSize: 50,
        total: 1,
        pageCount: 1,
        summary: { totalAmountToman: 0, byStatus: {}, byProvider: {} },
      }),
    ).toBeNull();

    expect(
      paymentAttemptNeedsReview(
        {
          ...attempt,
          status: 'CREATED',
          createdAt: '2026-09-08T08:00:00.000Z',
        },
        new Date('2026-09-08T09:00:00.000Z').getTime(),
      ),
    ).toBe(true);
  });
});
