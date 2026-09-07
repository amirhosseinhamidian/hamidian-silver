import { describe, expect, it } from 'vitest';

import {
  parsePaymentInitiationCandidates,
  parsePaymentOperationsSummary,
  parsePaymentReconciliations,
} from '@/lib/payments/payment-operations-model';

describe('payment operations model', () => {
  it('parses the operational summary and provider distribution', () => {
    expect(
      parsePaymentOperationsSummary({
        generatedAt: '2026-09-07T12:00:00.000Z',
        stuckInitiations: 2,
        openReconciliations: 1,
        escalatedInitiations: 1,
        escalatedReconciliations: 0,
        byProvider: {
          stuckInitiations: { zarinpal: 2 },
          openReconciliations: { zarinpal: 1 },
        },
      }),
    ).toMatchObject({ stuckInitiations: 2, byProvider: { openReconciliations: { zarinpal: 1 } } });
  });

  it('rejects malformed records instead of exposing incomplete payment operations', () => {
    expect(parsePaymentOperationsSummary({ generatedAt: 'invalid' })).toBeNull();
    expect(parsePaymentInitiationCandidates([{ id: 'attempt-1' }])).toBeNull();
    expect(parsePaymentReconciliations({})).toBeNull();
  });

  it('parses initiation recovery and reconciliation rows', () => {
    const order = {
      id: 'order-1',
      orderNumber: 'HS-1701',
      status: 'PENDING_PAYMENT',
      grandTotalToman: 2_500_000,
      reservationExpiresAt: '2026-09-07T12:30:00.000Z',
    };
    expect(
      parsePaymentInitiationCandidates([
        {
          id: 'attempt-1',
          provider: 'zarinpal',
          status: 'CREATED',
          amountToman: 2_500_000,
          createdAt: '2026-09-07T12:00:00.000Z',
          updatedAt: '2026-09-07T12:00:00.000Z',
          payment: { id: 'payment-1', status: 'PENDING', amountToman: 2_500_000, order },
        },
      ]),
    )?.toHaveLength(1);
    expect(
      parsePaymentReconciliations([
        {
          id: 'reconciliation-1',
          provider: 'zarinpal',
          providerReference: 'REF-1',
          amountToman: 2_500_000,
          detectedOrderStatus: 'EXPIRED',
          reason: 'callback after expiry',
          status: 'OPEN',
          resolution: null,
          externalReference: null,
          resolutionNote: null,
          resolvedAt: null,
          resolvedBy: null,
          createdAt: '2026-09-07T12:00:00.000Z',
          updatedAt: '2026-09-07T12:00:00.000Z',
          paymentAttempt: {
            id: 'attempt-2',
            provider: 'zarinpal',
            authority: 'A-1',
            providerReference: 'REF-1',
            amountToman: 2_500_000,
            status: 'RECONCILIATION_REQUIRED',
            verifiedAt: null,
            payment: {
              id: 'payment-1',
              status: 'RECONCILIATION_REQUIRED',
              amountToman: 2_500_000,
              order,
            },
          },
        },
      ]),
    )?.toHaveLength(1);
  });
});
