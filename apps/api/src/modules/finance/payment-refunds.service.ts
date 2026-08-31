import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import {
  PaymentAttemptStatus,
  PaymentRefundStatus,
  PaymentStatus,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { CancelPaymentRefundDto } from './dto/cancel-payment-refund.dto';
import { ConfirmPaymentRefundDto } from './dto/confirm-payment-refund.dto';
import { CreatePaymentRefundDto } from './dto/create-payment-refund.dto';
import { ListPaymentRefundsQueryDto } from './dto/list-payment-refunds-query.dto';

@Injectable()
export class PaymentRefundsService {
  constructor(private readonly prisma: PrismaService) {}

  list(query: ListPaymentRefundsQueryDto) {
    const createdAt = this.buildDateRange(query.from, query.to);

    return this.prisma.paymentRefund.findMany({
      where: {
        status: query.status,
        payment: query.orderId
          ? {
              orderId: query.orderId,
            }
          : undefined,
        createdAt,
      },
      take: query.limit ?? 50,
      orderBy: {
        createdAt: 'desc',
      },
      include: this.refundInclude(),
    });
  }

  async get(refundId: string) {
    const refund = await this.prisma.paymentRefund.findUnique({
      where: {
        id: refundId,
      },
      include: this.refundInclude(),
    });

    if (!refund) {
      throw new NotFoundException('Payment refund was not found.');
    }

    return refund;
  }

  async create(actorUserId: string, dto: CreatePaymentRefundDto) {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const payment = await transaction.payment.findUnique({
          where: {
            orderId: dto.orderId,
          },
          include: {
            order: {
              select: {
                id: true,
                orderNumber: true,
                financeSnapshot: {
                  select: {
                    id: true,
                  },
                },
              },
            },
            attempts: {
              where: {
                status: PaymentAttemptStatus.VERIFIED,
              },
              orderBy: {
                verifiedAt: 'desc',
              },
              take: 1,
              select: {
                provider: true,
                providerReference: true,
              },
            },
          },
        });

        if (!payment) {
          throw new NotFoundException('Payment was not found.');
        }

        const existing = await transaction.paymentRefund.findUnique({
          where: {
            idempotencyKey: dto.idempotencyKey,
          },
        });

        if (existing) {
          if (existing.paymentId !== payment.id || existing.amountToman !== dto.amountToman) {
            throw new ConflictException('Refund idempotency key is already in use.');
          }

          return existing;
        }

        if (!payment.order.financeSnapshot) {
          throw new ConflictException(
            'Order finance snapshot is required before recording a customer refund.',
          );
        }

        if (
          payment.status !== PaymentStatus.PAID &&
          payment.status !== PaymentStatus.PARTIALLY_REFUNDED
        ) {
          throw new ConflictException('Payment is not refundable from its current status.');
        }

        const remainingAllocatable = payment.amountToman - payment.refundAllocatedToman;

        if (dto.amountToman > remainingAllocatable) {
          throw new ConflictException(
            'Refund amount exceeds the remaining refundable payment amount.',
          );
        }

        const verifiedAttempt = payment.attempts[0];

        if (!verifiedAttempt?.providerReference) {
          throw new ConflictException(
            'Verified payment provider identity is required before recording a customer refund.',
          );
        }

        const claimed = await transaction.payment.updateMany({
          where: {
            id: payment.id,
            status: {
              in: [PaymentStatus.PAID, PaymentStatus.PARTIALLY_REFUNDED],
            },
            refundAllocatedToman: {
              lte: payment.amountToman - dto.amountToman,
            },
          },
          data: {
            refundAllocatedToman: {
              increment: dto.amountToman,
            },
          },
        });

        if (claimed.count !== 1) {
          throw new ConflictException('Payment refund capacity changed; reload and retry.');
        }

        return transaction.paymentRefund.create({
          data: {
            paymentId: payment.id,
            idempotencyKey: dto.idempotencyKey,
            amountToman: dto.amountToman,
            providerSnapshot: verifiedAttempt.provider,
            originalProviderReferenceSnapshot: verifiedAttempt.providerReference,
            requestNote: dto.note,
            requestedByUserId: actorUserId,
          },
          include: this.refundInclude(),
        });
      });
    } catch (error) {
      if (!this.isUniqueConstraintError(error)) {
        throw error;
      }

      const existing = await this.prisma.paymentRefund.findUnique({
        where: {
          idempotencyKey: dto.idempotencyKey,
        },
      });

      if (!existing) {
        throw error;
      }

      const payment = await this.prisma.payment.findUnique({
        where: {
          orderId: dto.orderId,
        },
        select: {
          id: true,
        },
      });

      if (
        !payment ||
        existing.paymentId !== payment.id ||
        existing.amountToman !== dto.amountToman
      ) {
        throw new ConflictException('Refund idempotency key is already in use.');
      }

      return existing;
    }
  }

  async confirm(refundId: string, actorUserId: string, dto: ConfirmPaymentRefundDto) {
    return this.prisma.$transaction(async (transaction) => {
      const refund = await transaction.paymentRefund.findUnique({
        where: {
          id: refundId,
        },
        include: {
          payment: {
            select: {
              id: true,
              status: true,
              amountToman: true,
              refundedAmountToman: true,
              refundAllocatedToman: true,
            },
          },
        },
      });

      if (!refund) {
        throw new NotFoundException('Payment refund was not found.');
      }

      if (refund.status === PaymentRefundStatus.CONFIRMED) {
        this.assertConfirmationReferenceMatches(refund.externalReference, dto.externalReference);

        return transaction.paymentRefund.findUniqueOrThrow({
          where: {
            id: refund.id,
          },
          include: this.refundInclude(),
        });
      }

      if (refund.status !== PaymentRefundStatus.PENDING) {
        throw new ConflictException('Only pending payment refunds can be confirmed.');
      }

      if (
        refund.payment.status !== PaymentStatus.PAID &&
        refund.payment.status !== PaymentStatus.PARTIALLY_REFUNDED
      ) {
        throw new ConflictException('Payment is not refundable from its current status.');
      }

      const nextRefundedAmountToman = refund.payment.refundedAmountToman + refund.amountToman;

      if (
        nextRefundedAmountToman > refund.payment.refundAllocatedToman ||
        nextRefundedAmountToman > refund.payment.amountToman
      ) {
        throw new ConflictException('Payment refund totals are inconsistent.');
      }

      const nextPaymentStatus =
        nextRefundedAmountToman === refund.payment.amountToman
          ? PaymentStatus.REFUNDED
          : PaymentStatus.PARTIALLY_REFUNDED;
      const confirmedAt = new Date();
      let claimed: { count: number };

      try {
        claimed = await transaction.paymentRefund.updateMany({
          where: {
            id: refund.id,
            status: PaymentRefundStatus.PENDING,
          },
          data: {
            status: PaymentRefundStatus.CONFIRMED,
            externalReference: dto.externalReference,
            resolutionNote: dto.note,
            confirmedByUserId: actorUserId,
            confirmedAt,
          },
        });
      } catch (error) {
        if (this.isUniqueConstraintError(error)) {
          throw new ConflictException(
            'External refund reference is already assigned to another confirmed refund.',
          );
        }

        throw error;
      }

      if (claimed.count !== 1) {
        const current = await transaction.paymentRefund.findUnique({
          where: {
            id: refund.id,
          },
        });

        if (current?.status === PaymentRefundStatus.CONFIRMED) {
          this.assertConfirmationReferenceMatches(current.externalReference, dto.externalReference);

          return transaction.paymentRefund.findUniqueOrThrow({
            where: {
              id: refund.id,
            },
            include: this.refundInclude(),
          });
        }

        throw new ConflictException('Payment refund state changed; reload and retry.');
      }

      const paymentClaimed = await transaction.payment.updateMany({
        where: {
          id: refund.paymentId,
          status: refund.payment.status,
          amountToman: refund.payment.amountToman,
          refundedAmountToman: refund.payment.refundedAmountToman,
          refundAllocatedToman: refund.payment.refundAllocatedToman,
        },
        data: {
          refundedAmountToman: {
            increment: refund.amountToman,
          },
          status: nextPaymentStatus,
        },
      });

      if (paymentClaimed.count !== 1) {
        throw new ConflictException('Payment refund totals changed; reload and retry.');
      }

      return transaction.paymentRefund.findUniqueOrThrow({
        where: {
          id: refund.id,
        },
        include: this.refundInclude(),
      });
    });
  }

  async cancel(refundId: string, actorUserId: string, dto: CancelPaymentRefundDto) {
    return this.prisma.$transaction(async (transaction) => {
      const refund = await transaction.paymentRefund.findUnique({
        where: {
          id: refundId,
        },
        include: {
          payment: {
            select: {
              id: true,
              status: true,
              amountToman: true,
              refundedAmountToman: true,
              refundAllocatedToman: true,
            },
          },
        },
      });

      if (!refund) {
        throw new NotFoundException('Payment refund was not found.');
      }

      if (refund.status === PaymentRefundStatus.CANCELLED) {
        return transaction.paymentRefund.findUniqueOrThrow({
          where: {
            id: refund.id,
          },
          include: this.refundInclude(),
        });
      }

      if (refund.status !== PaymentRefundStatus.PENDING) {
        throw new ConflictException('Only pending payment refunds can be cancelled.');
      }

      const nextRefundAllocatedToman = refund.payment.refundAllocatedToman - refund.amountToman;

      if (
        nextRefundAllocatedToman < 0 ||
        nextRefundAllocatedToman < refund.payment.refundedAmountToman ||
        nextRefundAllocatedToman > refund.payment.amountToman
      ) {
        throw new ConflictException('Payment refund allocation is inconsistent.');
      }

      const cancelledAt = new Date();
      const claimed = await transaction.paymentRefund.updateMany({
        where: {
          id: refund.id,
          status: PaymentRefundStatus.PENDING,
        },
        data: {
          status: PaymentRefundStatus.CANCELLED,
          resolutionNote: dto.reason,
          cancelledByUserId: actorUserId,
          cancelledAt,
        },
      });

      if (claimed.count !== 1) {
        const current = await transaction.paymentRefund.findUnique({
          where: {
            id: refund.id,
          },
        });

        if (current?.status === PaymentRefundStatus.CANCELLED) {
          return transaction.paymentRefund.findUniqueOrThrow({
            where: {
              id: refund.id,
            },
            include: this.refundInclude(),
          });
        }

        throw new ConflictException('Payment refund state changed; reload and retry.');
      }

      const released = await transaction.payment.updateMany({
        where: {
          id: refund.paymentId,
          status: refund.payment.status,
          amountToman: refund.payment.amountToman,
          refundedAmountToman: refund.payment.refundedAmountToman,
          refundAllocatedToman: refund.payment.refundAllocatedToman,
        },
        data: {
          refundAllocatedToman: {
            decrement: refund.amountToman,
          },
        },
      });

      if (released.count !== 1) {
        throw new ConflictException('Payment refund totals changed; reload and retry.');
      }

      return transaction.paymentRefund.findUniqueOrThrow({
        where: {
          id: refund.id,
        },
        include: this.refundInclude(),
      });
    });
  }

  private assertConfirmationReferenceMatches(
    persistedReference: string | null,
    requestedReference: string,
  ): void {
    if (persistedReference !== requestedReference) {
      throw new ConflictException(
        'Payment refund is already confirmed with a different external reference.',
      );
    }
  }

  private refundInclude() {
    return {
      payment: {
        select: {
          id: true,
          orderId: true,
          status: true,
          amountToman: true,
          refundedAmountToman: true,
          refundAllocatedToman: true,
          order: {
            select: {
              id: true,
              orderNumber: true,
              status: true,
            },
          },
        },
      },
      requestedBy: {
        select: {
          id: true,
          phone: true,
          firstName: true,
          lastName: true,
        },
      },
      confirmedBy: {
        select: {
          id: true,
          phone: true,
          firstName: true,
          lastName: true,
        },
      },
      cancelledBy: {
        select: {
          id: true,
          phone: true,
          firstName: true,
          lastName: true,
        },
      },
    } satisfies Prisma.PaymentRefundInclude;
  }

  private buildDateRange(from?: string, to?: string): Prisma.DateTimeFilter | undefined {
    const fromDate = from ? new Date(from) : undefined;
    const toDate = to ? new Date(to) : undefined;

    if (fromDate && toDate && fromDate > toDate) {
      throw new BadRequestException('Refund report start date must be before the end date.');
    }

    if (!fromDate && !toDate) {
      return undefined;
    }

    return {
      ...(fromDate ? { gte: fromDate } : {}),
      ...(toDate ? { lte: toDate } : {}),
    };
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
  }
}
