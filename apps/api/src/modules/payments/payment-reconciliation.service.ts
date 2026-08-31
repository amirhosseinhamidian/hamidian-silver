import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  PaymentAttemptStatus,
  PaymentReconciliationResolution,
  PaymentReconciliationStatus,
  PaymentStatus,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../infrastructure/database/prisma.service';

@Injectable()
export class PaymentReconciliationService {
  constructor(private readonly prisma: PrismaService) {}

  list(status?: PaymentReconciliationStatus) {
    return this.prisma.paymentReconciliation.findMany({
      where: status
        ? {
            status,
          }
        : undefined,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        paymentAttempt: {
          select: {
            id: true,
            provider: true,
            authority: true,
            providerReference: true,
            amountToman: true,
            status: true,
            verifiedAt: true,
            payment: {
              select: {
                id: true,
                status: true,
                amountToman: true,
                order: {
                  select: {
                    id: true,
                    orderNumber: true,
                    status: true,
                  },
                },
              },
            },
          },
        },
        resolvedBy: {
          select: {
            id: true,
            phone: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  async resolveExternalRefund(
    reconciliationId: string,
    actorUserId: string,
    resolutionNote: string,
  ) {
    return this.prisma.$transaction(async (transaction) => {
      const reconciliation = await transaction.paymentReconciliation.findUnique({
        where: {
          id: reconciliationId,
        },
        include: {
          paymentAttempt: {
            include: {
              payment: true,
            },
          },
        },
      });

      if (!reconciliation) {
        throw new NotFoundException('Payment reconciliation was not found.');
      }

      if (reconciliation.status === PaymentReconciliationStatus.RESOLVED) {
        if (reconciliation.resolution === PaymentReconciliationResolution.REFUNDED_EXTERNALLY) {
          return reconciliation;
        }

        throw new ConflictException('Payment reconciliation is already resolved.');
      }

      const paymentStatus = reconciliation.paymentAttempt.payment.status;
      const preserveSettledPayment =
        paymentStatus === PaymentStatus.PAID ||
        paymentStatus === PaymentStatus.PARTIALLY_REFUNDED ||
        paymentStatus === PaymentStatus.REFUNDED;

      if (
        reconciliation.paymentAttempt.status !== PaymentAttemptStatus.RECONCILIATION_REQUIRED ||
        (!preserveSettledPayment && paymentStatus !== PaymentStatus.RECONCILIATION_REQUIRED)
      ) {
        throw new ConflictException('Payment reconciliation state no longer matches the payment.');
      }

      const resolvedAt = new Date();
      const claimed = await transaction.paymentReconciliation.updateMany({
        where: {
          id: reconciliation.id,
          status: PaymentReconciliationStatus.OPEN,
          resolution: null,
          resolvedAt: null,
        },
        data: {
          status: PaymentReconciliationStatus.RESOLVED,
          resolution: PaymentReconciliationResolution.REFUNDED_EXTERNALLY,
          resolutionNote,
          resolvedByUserId: actorUserId,
          resolvedAt,
        },
      });

      if (claimed.count !== 1) {
        const current = await transaction.paymentReconciliation.findUnique({
          where: {
            id: reconciliation.id,
          },
        });

        if (
          current?.status === PaymentReconciliationStatus.RESOLVED &&
          current.resolution === PaymentReconciliationResolution.REFUNDED_EXTERNALLY
        ) {
          return current;
        }

        throw new ConflictException(
          'Payment reconciliation changed while resolving; reload before retrying.',
        );
      }

      if (!preserveSettledPayment) {
        const payment = await transaction.payment.updateMany({
          where: {
            id: reconciliation.paymentAttempt.paymentId,
            status: PaymentStatus.RECONCILIATION_REQUIRED,
          },
          data: {
            status: PaymentStatus.REFUNDED,
          },
        });

        if (payment.count !== 1) {
          throw new ConflictException('Payment state changed while resolving reconciliation.');
        }
      }

      const attempt = await transaction.paymentAttempt.updateMany({
        where: {
          id: reconciliation.paymentAttemptId,
          status: PaymentAttemptStatus.RECONCILIATION_REQUIRED,
        },
        data: {
          status: PaymentAttemptStatus.RECONCILED,
          failureCode: null,
          failureMessage: null,
        },
      });

      if (attempt.count !== 1) {
        throw new ConflictException(
          'Payment attempt state changed while resolving reconciliation.',
        );
      }

      return transaction.paymentReconciliation.findUniqueOrThrow({
        where: {
          id: reconciliation.id,
        },
        include: {
          paymentAttempt: {
            select: {
              id: true,
              provider: true,
              providerReference: true,
              amountToman: true,
              status: true,
              payment: {
                select: {
                  status: true,
                  orderId: true,
                },
              },
            },
          },
        },
      });
    });
  }
}
