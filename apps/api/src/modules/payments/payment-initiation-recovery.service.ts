import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { lockOrderRowForUpdate } from '../../common/order-row-lock';
import { OrderStatus, PaymentAttemptStatus, PaymentStatus } from '../../generated/prisma/enums';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import {
  PaymentInitiationRecoveryResolution,
  type ResolvePaymentInitiationRecoveryDto,
} from './dto/resolve-payment-initiation-recovery.dto';

const RECOVERY_MIN_AGE_MS = 2 * 60 * 1000;
const RECOVERY_FAILURE_CODE = 'INITIATION_RECOVERY_ABANDONED';
const RECOVERY_FAILURE_MESSAGE =
  'Manager abandoned an unknown payment initiation after provider review.';

@Injectable()
export class PaymentInitiationRecoveryService {
  constructor(private readonly prisma: PrismaService) {}

  listCandidates(now = new Date()) {
    const cutoff = new Date(now.getTime() - RECOVERY_MIN_AGE_MS);

    return this.prisma.paymentAttempt.findMany({
      where: {
        status: PaymentAttemptStatus.CREATED,
        createdAt: {
          lte: cutoff,
        },
      },
      take: 100,
      orderBy: {
        createdAt: 'asc',
      },
      select: {
        id: true,
        provider: true,
        status: true,
        amountToman: true,
        createdAt: true,
        updatedAt: true,
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
                grandTotalToman: true,
                reservationExpiresAt: true,
              },
            },
          },
        },
      },
    });
  }

  async resolve(
    attemptId: string,
    actorUserId: string,
    dto: ResolvePaymentInitiationRecoveryDto,
    now = new Date(),
  ) {
    return this.prisma.$transaction(async (transaction) => {
      const locator = await transaction.paymentAttempt.findUnique({
        where: {
          id: attemptId,
        },
        select: {
          payment: {
            select: {
              orderId: true,
            },
          },
        },
      });

      if (!locator) {
        throw new NotFoundException('Payment attempt was not found.');
      }

      await lockOrderRowForUpdate(transaction, locator.payment.orderId);

      const attempt = await transaction.paymentAttempt.findUnique({
        where: {
          id: attemptId,
        },
        include: {
          payment: {
            include: {
              order: true,
            },
          },
        },
      });

      if (!attempt) {
        throw new NotFoundException('Payment attempt was not found.');
      }

      if (attempt.status !== PaymentAttemptStatus.CREATED) {
        return this.resolveExisting(attempt, dto);
      }

      const cutoff = new Date(now.getTime() - RECOVERY_MIN_AGE_MS);

      if (attempt.createdAt > cutoff) {
        throw new ConflictException(
          'Payment attempt is too recent for manual initiation recovery.',
        );
      }

      if (
        attempt.payment.status !== PaymentStatus.PENDING &&
        attempt.payment.status !== PaymentStatus.CANCELLED
      ) {
        throw new ConflictException('Payment state no longer permits initiation recovery.');
      }

      const resolutionData =
        dto.resolution === PaymentInitiationRecoveryResolution.REDIRECTED
          ? this.redirectResolutionData(attempt, dto, now)
          : this.abandonedResolutionData(dto);
      const data = {
        ...resolutionData,
        initiationRecoveryResolution: dto.resolution,
        initiationRecoveryNote: dto.note ?? null,
        initiationRecoveryResolvedByUserId: actorUserId,
        initiationRecoveryResolvedAt: now,
      };

      let resolved: { count: number };

      try {
        resolved = await transaction.paymentAttempt.updateMany({
          where: {
            id: attempt.id,
            status: PaymentAttemptStatus.CREATED,
            createdAt: {
              lte: cutoff,
            },
          },
          data,
        });
      } catch (error) {
        if (this.isUniqueConstraintError(error)) {
          throw new ConflictException(
            'Recovered gateway authority is already attached to another payment attempt.',
          );
        }

        throw error;
      }

      if (resolved.count !== 1) {
        const current = await transaction.paymentAttempt.findUnique({
          where: {
            id: attempt.id,
          },
          include: {
            payment: {
              include: {
                order: true,
              },
            },
          },
        });

        if (!current) {
          throw new NotFoundException('Payment attempt was not found.');
        }

        return this.resolveExisting(current, dto);
      }

      return transaction.paymentAttempt.findUniqueOrThrow({
        where: {
          id: attempt.id,
        },
        include: {
          payment: {
            include: {
              order: true,
            },
          },
        },
      });
    });
  }

  private redirectResolutionData(
    attempt: {
      amountToman: number;
      payment: {
        status: PaymentStatus;
        amountToman: number;
        order: {
          status: OrderStatus;
          grandTotalToman: number;
          reservationExpiresAt: Date;
        };
      };
    },
    dto: ResolvePaymentInitiationRecoveryDto,
    now: Date,
  ) {
    if (!dto.authority || !dto.paymentUrl) {
      throw new BadRequestException(
        'Recovered authority and payment URL are required for a redirected resolution.',
      );
    }

    if (
      attempt.payment.status !== PaymentStatus.PENDING ||
      attempt.payment.order.status !== OrderStatus.PENDING_PAYMENT ||
      attempt.payment.order.reservationExpiresAt <= now
    ) {
      throw new ConflictException(
        'Order is no longer payable; the initiation cannot be restored to a redirect.',
      );
    }

    if (
      attempt.amountToman !== attempt.payment.amountToman ||
      attempt.payment.amountToman !== attempt.payment.order.grandTotalToman
    ) {
      throw new ConflictException(
        'Payment amount snapshots are inconsistent; the initiation cannot be restored.',
      );
    }

    return {
      status: PaymentAttemptStatus.REDIRECTED,
      authority: dto.authority,
      paymentUrl: dto.paymentUrl,
      failureCode: null,
      failureMessage: null,
    };
  }

  private abandonedResolutionData(dto: ResolvePaymentInitiationRecoveryDto) {
    if (dto.authority || dto.paymentUrl) {
      throw new BadRequestException(
        'Authority and payment URL are only valid for a redirected recovery.',
      );
    }

    return {
      status: PaymentAttemptStatus.FAILED,
      failureCode: RECOVERY_FAILURE_CODE,
      failureMessage: RECOVERY_FAILURE_MESSAGE,
    };
  }

  private resolveExisting(
    attempt: {
      status: PaymentAttemptStatus;
      authority: string | null;
      paymentUrl: string | null;
      failureCode: string | null;
      initiationRecoveryResolution: string | null;
    },
    dto: ResolvePaymentInitiationRecoveryDto,
  ) {
    if (
      dto.resolution === PaymentInitiationRecoveryResolution.REDIRECTED &&
      attempt.initiationRecoveryResolution === PaymentInitiationRecoveryResolution.REDIRECTED &&
      attempt.status !== PaymentAttemptStatus.CREATED &&
      attempt.authority === dto.authority &&
      attempt.paymentUrl === dto.paymentUrl
    ) {
      return attempt;
    }

    if (
      dto.resolution === PaymentInitiationRecoveryResolution.ABANDONED &&
      attempt.initiationRecoveryResolution === PaymentInitiationRecoveryResolution.ABANDONED &&
      attempt.status === PaymentAttemptStatus.FAILED &&
      attempt.failureCode === RECOVERY_FAILURE_CODE
    ) {
      return attempt;
    }

    throw new ConflictException(
      'Payment attempt state changed while resolving initiation recovery.',
    );
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
  }
}
