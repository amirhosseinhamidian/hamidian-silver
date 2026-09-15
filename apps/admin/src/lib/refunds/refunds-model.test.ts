import { describe, expect, it } from 'vitest';

import { parsePaymentRefunds, parseRefundOrders } from '@/lib/refunds/refunds-model';

const refund = {
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

describe('refunds model', () => {
  it('parses refund amounts, payment allocation and operator evidence', () => {
    expect(parsePaymentRefunds([refund]))?.toEqual([
      expect.objectContaining({
        id: 'refund-1',
        status: 'PENDING',
        amountToman: 500_000,
        payment: expect.objectContaining({ refundAllocatedToman: 500_000 }),
        requestedBy: expect.objectContaining({ firstName: 'مدیر' }),
      }),
    ]);
  });

  it('rejects malformed status, amount and actor data', () => {
    expect(parsePaymentRefunds({})).toBeNull();
    expect(parsePaymentRefunds([{ ...refund, status: 'UNKNOWN' }])).toBeNull();
    expect(parsePaymentRefunds([{ ...refund, amountToman: 'invalid' }])).toBeNull();
    expect(parsePaymentRefunds([{ ...refund, requestedBy: { id: 'admin-1' } }])).toBeNull();
  });

  it('parses finance-scoped refundable order candidates', () => {
    expect(
      parseRefundOrders([
        {
          id: 'snapshot-1',
          order: {
            id: 'order-1',
            orderNumber: 'HS-2101',
            status: 'DELIVERED',
            user: {
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
          },
        },
      ]),
    )?.toEqual([
      expect.objectContaining({
        orderNumber: 'HS-2101',
        payment: expect.objectContaining({ refundAllocatedToman: 500_000 }),
      }),
    ]);
  });
});
