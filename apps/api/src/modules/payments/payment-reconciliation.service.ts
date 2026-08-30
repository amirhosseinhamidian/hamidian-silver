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

      if (
        reconciliation.paymentAttempt.payment.status !== PaymentStatus.RECONCILIATION_REQUIRED ||
        reconciliation.paymentAttempt.status !== PaymentAttemptStatus.RECONCILIATION_REQUIRED
      ) {
        throw new ConflictException('Payment reconciliation state no longer matches the payment.');
      }

      const resolvedAt = new Date();

      await transaction.payment.update({
        where: {
          id: reconciliation.paymentAttempt.paymentId,
        },
        data: {
          status: PaymentStatus.REFUNDED,
        },
      });

      await transaction.paymentAttempt.update({
        where: {
          id: reconciliation.paymentAttemptId,
        },
        data: {
          status: PaymentAttemptStatus.RECONCILED,
          failureCode: null,
          failureMessage: null,
        },
      });

      return transaction.paymentReconciliation.update({
        where: {
          id: reconciliation.id,
        },
        data: {
          status: PaymentReconciliationStatus.RESOLVED,
          resolution: PaymentReconciliationResolution.REFUNDED_EXTERNALLY,
          resolutionNote,
          resolvedByUserId: actorUserId,
          resolvedAt,
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
