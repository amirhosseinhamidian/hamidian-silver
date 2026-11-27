import { classifyWalletReservation } from './wallet-reservation-reconciliation';

const reservedAt = new Date('2026-11-24T13:00:00Z');
const now = new Date('2026-11-24T14:00:00Z');
const live = {
  reservationAmountToman: 1_000,
  allocatedToman: 1_000n,
  reservationUserId: 'buyer',
  reservedAt,
  order: {
    userId: 'buyer',
    walletAppliedToman: 1_000,
    status: 'PENDING_PAYMENT' as const,
    paidAt: null,
    reservationExpiresAt: new Date('2026-11-24T15:00:00Z'),
  },
  payment: null,
  attempts: [],
};

describe('wallet reservation reconciliation', () => {
  it('uses the current reservation when checking for a definitive failure', () => {
    expect(
      classifyWalletReservation(
        {
          ...live,
          payment: { status: 'PENDING', paidAt: null },
          attempts: [{ status: 'FAILED', updatedAt: new Date(+reservedAt - 1) }],
        },
        now,
      ),
    ).toBe('KEEP');
    expect(
      classifyWalletReservation(
        {
          ...live,
          payment: { status: 'PENDING', paidAt: null },
          attempts: [{ status: 'FAILED', updatedAt: now }],
        },
        now,
      ),
    ).toBe('RELEASE');
    expect(
      classifyWalletReservation(
        {
          ...live,
          payment: { status: 'PENDING', paidAt: null },
          attempts: [{ status: 'FAILED', updatedAt: now, failureCode: 'PAYMENT_METHOD_CHANGED' }],
        },
        now,
      ),
    ).toBe('KEEP');
  });

  it.each([
    ['CREATED', 'PAYMENT_UNCERTAIN'],
    ['REDIRECTED', 'PAYMENT_UNCERTAIN'],
    ['RECONCILIATION_REQUIRED', 'PAYMENT_UNCERTAIN'],
    ['AWAITING_REVIEW', 'RECEIPT_PENDING'],
    ['VERIFIED', 'SETTLEMENT_MISMATCH'],
  ] as const)('holds %s even when the order is expired', (status, issue) => {
    expect(
      classifyWalletReservation(
        {
          ...live,
          order: { ...live.order, status: 'EXPIRED' },
          attempts: [{ status, updatedAt: reservedAt }],
        },
        now,
      ),
    ).toBe(issue);
  });

  it('reports the amount mismatch before attempting to recover a terminal reservation', () => {
    expect(
      classifyWalletReservation(
        { ...live, allocatedToman: 999n, order: { ...live.order, status: 'CANCELLED' } },
        now,
      ),
    ).toBe('RESERVATION_MISMATCH');
    expect(
      classifyWalletReservation({ ...live, order: { ...live.order, status: 'CANCELLED' } }, now),
    ).toBe('RELEASE');
  });
});
