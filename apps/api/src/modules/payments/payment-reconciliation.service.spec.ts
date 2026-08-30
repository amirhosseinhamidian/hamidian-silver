import {
  PaymentAttemptStatus,
  PaymentReconciliationResolution,
  PaymentReconciliationStatus,
  PaymentStatus,
} from '../../generated/prisma/enums';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { PaymentReconciliationService } from './payment-reconciliation.service';

describe('PaymentReconciliationService', () => {
  it('marks an externally-refunded reconciliation as resolved', async () => {
    const reconciliationId = '10000000-0000-4000-8000-000000000001';
    const paymentAttemptId = '20000000-0000-4000-8000-000000000001';
    const paymentId = '30000000-0000-4000-8000-000000000001';
    const actorUserId = '40000000-0000-4000-8000-000000000001';
    const transaction = {
      paymentReconciliation: {
        findUnique: jest.fn().mockResolvedValue({
          id: reconciliationId,
          paymentAttemptId,
          status: PaymentReconciliationStatus.OPEN,
          resolution: null,
          paymentAttempt: {
            id: paymentAttemptId,
            paymentId,
            status: PaymentAttemptStatus.RECONCILIATION_REQUIRED,
            payment: {
              status: PaymentStatus.RECONCILIATION_REQUIRED,
            },
          },
        }),
        update: jest.fn().mockResolvedValue({
          id: reconciliationId,
          status: PaymentReconciliationStatus.RESOLVED,
          resolution: PaymentReconciliationResolution.REFUNDED_EXTERNALLY,
        }),
      },
      payment: {
        update: jest.fn().mockResolvedValue({}),
      },
      paymentAttempt: {
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const service = new PaymentReconciliationService(prisma as unknown as PrismaService);

    await service.resolveExternalRefund(
      reconciliationId,
      actorUserId,
      'Refund confirmed in gateway dashboard.',
    );

    expect(transaction.payment.update).toHaveBeenCalledWith({
      where: {
        id: paymentId,
      },
      data: {
        status: PaymentStatus.REFUNDED,
      },
    });
    expect(transaction.paymentAttempt.update).toHaveBeenCalledWith({
      where: {
        id: paymentAttemptId,
      },
      data: {
        status: PaymentAttemptStatus.RECONCILED,
        failureCode: null,
        failureMessage: null,
      },
    });
    expect(transaction.paymentReconciliation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: reconciliationId,
        },
        data: expect.objectContaining({
          status: PaymentReconciliationStatus.RESOLVED,
          resolution: PaymentReconciliationResolution.REFUNDED_EXTERNALLY,
          resolutionNote: 'Refund confirmed in gateway dashboard.',
          resolvedByUserId: actorUserId,
        }),
      }),
    );
  });
});
