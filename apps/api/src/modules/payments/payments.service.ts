import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '../../generated/prisma/client';
import {
  InventoryMovementType,
  OrderStatus,
  PaymentAttemptStatus,
  PaymentStatus,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { PAYMENT_GATEWAY, type PaymentGateway } from './payment-gateway.port';

type InitiationContext = {
  attemptId: string;
  orderNumber: string;
  amountToman: number;
  authority?: string | null;
  paymentUrl?: string | null;
  status: PaymentAttemptStatus;
  isNew: boolean;
};

@Injectable()
export class PaymentsService {
  private readonly callbackBaseUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
  ) {
    this.callbackBaseUrl = this.config.get<string>(
      'PAYMENT_CALLBACK_URL',
      'http://localhost:3000/api/v1/payments/callback',
    );
  }

  async initiateOrderPayment(userId: string, orderId: string, dto: InitiatePaymentDto) {
    let context: InitiationContext;

    try {
      context = await this.createOrLoadAttempt(userId, orderId, dto.idempotencyKey);
    } catch (error) {
      if (!this.isUniqueConstraintError(error)) {
        throw error;
      }

      const existing = await this.prisma.paymentAttempt.findUnique({
        where: {
          idempotencyKey: dto.idempotencyKey,
        },
        include: {
          payment: {
            include: {
              order: {
                select: {
                  id: true,
                  userId: true,
                  orderNumber: true,
                },
              },
            },
          },
        },
      });

      if (
        !existing ||
        existing.payment.order.id !== orderId ||
        existing.payment.order.userId !== userId
      ) {
        throw new ConflictException('Idempotency key is already in use.');
      }

      context = {
        attemptId: existing.id,
        orderNumber: existing.payment.order.orderNumber,
        amountToman: existing.amountToman,
        authority: existing.authority,
        paymentUrl: existing.paymentUrl,
        status: existing.status,
        isNew: false,
      };
    }

    if (context.status === PaymentAttemptStatus.VERIFIED) {
      return {
        attemptId: context.attemptId,
        status: context.status,
        alreadyPaid: true,
      };
    }

    if (context.paymentUrl && context.authority) {
      return {
        attemptId: context.attemptId,
        status: context.status,
        authority: context.authority,
        paymentUrl: context.paymentUrl,
      };
    }

    if (context.status === PaymentAttemptStatus.FAILED) {
      throw new ConflictException(
        'This idempotency key belongs to a failed payment attempt. Use a new key.',
      );
    }

    if (!context.isNew && context.status === PaymentAttemptStatus.CREATED) {
      throw new ConflictException('Payment attempt is still being initialized.');
    }

    const callbackUrl = `${this.callbackBaseUrl}/${context.attemptId}`;

    try {
      const initiated = await this.gateway.initiate({
        attemptId: context.attemptId,
        orderNumber: context.orderNumber,
        amountRial: this.tomanToRial(context.amountToman),
        callbackUrl,
      });

      const updated = await this.prisma.paymentAttempt.update({
        where: {
          id: context.attemptId,
        },
        data: {
          authority: initiated.authority,
          paymentUrl: initiated.paymentUrl,
          status: PaymentAttemptStatus.REDIRECTED,
        },
      });

      return {
        attemptId: updated.id,
        status: updated.status,
        authority: updated.authority,
        paymentUrl: updated.paymentUrl,
      };
    } catch (error) {
      await this.prisma.paymentAttempt.updateMany({
        where: {
          id: context.attemptId,
          status: PaymentAttemptStatus.CREATED,
        },
        data: {
          status: PaymentAttemptStatus.FAILED,
          failureMessage: 'Payment initiation failed.',
        },
      });

      throw error;
    }
  }

  async verifyCallback(attemptId: string, authority: string) {
    const attempt = await this.prisma.paymentAttempt.findUnique({
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

    if (
      attempt.status === PaymentAttemptStatus.VERIFIED ||
      attempt.payment.status === PaymentStatus.PAID ||
      attempt.payment.order.status === OrderStatus.PAID
    ) {
      return {
        success: true,
        alreadyVerified: true,
        orderId: attempt.payment.orderId,
        referenceId: attempt.providerReference,
      };
    }

    if (!attempt.authority || attempt.authority !== authority) {
      throw new BadRequestException('Payment authority does not match.');
    }

    const verification = await this.gateway.verify({
      authority,
      amountRial: this.tomanToRial(attempt.amountToman),
    });

    if (!verification.success) {
      await this.prisma.paymentAttempt.updateMany({
        where: {
          id: attempt.id,
          status: {
            not: PaymentAttemptStatus.VERIFIED,
          },
        },
        data: {
          status: PaymentAttemptStatus.FAILED,
          failureCode: verification.code,
          failureMessage: verification.message ?? 'Payment verification failed.',
        },
      });

      throw new BadRequestException('Payment verification failed.');
    }

    return this.finalizeVerifiedPayment(attempt.id, authority, verification.referenceId);
  }

  async getOrderPayment(userId: string, orderId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: {
        orderId,
        order: {
          userId,
        },
      },
      include: {
        attempts: {
          orderBy: {
            createdAt: 'desc',
          },
          select: {
            id: true,
            provider: true,
            status: true,
            amountToman: true,
            authority: true,
            providerReference: true,
            verifiedAt: true,
            createdAt: true,
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment was not found.');
    }

    return payment;
  }

  private async createOrLoadAttempt(
    userId: string,
    orderId: string,
    idempotencyKey: string,
  ): Promise<InitiationContext> {
    return this.prisma.$transaction(async (transaction) => {
      const order = await transaction.order.findFirst({
        where: {
          id: orderId,
          userId,
        },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          grandTotalToman: true,
          reservationExpiresAt: true,
        },
      });

      if (!order) {
        throw new NotFoundException('Order was not found.');
      }

      if (order.status === OrderStatus.PAID) {
        const paidAttempt = await transaction.paymentAttempt.findFirst({
          where: {
            payment: {
              orderId: order.id,
            },
            status: PaymentAttemptStatus.VERIFIED,
          },
          orderBy: {
            verifiedAt: 'desc',
          },
        });

        if (paidAttempt) {
          return {
            attemptId: paidAttempt.id,
            orderNumber: order.orderNumber,
            amountToman: paidAttempt.amountToman,
            authority: paidAttempt.authority,
            paymentUrl: paidAttempt.paymentUrl,
            status: paidAttempt.status,
            isNew: false,
          };
        }

        throw new ConflictException('Order is already paid.');
      }

      if (order.status !== OrderStatus.PENDING_PAYMENT) {
        throw new ConflictException('Order is not payable.');
      }

      if (order.reservationExpiresAt <= new Date()) {
        throw new ConflictException('Order inventory reservation has expired.');
      }

      const payment = await transaction.payment.upsert({
        where: {
          orderId: order.id,
        },
        update: {},
        create: {
          orderId: order.id,
          amountToman: order.grandTotalToman,
        },
      });

      if (payment.amountToman !== order.grandTotalToman) {
        throw new ConflictException('Order total no longer matches payment amount.');
      }

      const existing = await transaction.paymentAttempt.findUnique({
        where: {
          idempotencyKey,
        },
      });

      if (existing) {
        if (existing.paymentId !== payment.id) {
          throw new ConflictException('Idempotency key is already in use.');
        }

        return {
          attemptId: existing.id,
          orderNumber: order.orderNumber,
          amountToman: existing.amountToman,
          authority: existing.authority,
          paymentUrl: existing.paymentUrl,
          status: existing.status,
          isNew: false,
        };
      }

      const attempt = await transaction.paymentAttempt.create({
        data: {
          paymentId: payment.id,
          idempotencyKey,
          provider: this.gateway.providerCode,
          amountToman: payment.amountToman,
        },
      });

      return {
        attemptId: attempt.id,
        orderNumber: order.orderNumber,
        amountToman: attempt.amountToman,
        authority: attempt.authority,
        paymentUrl: attempt.paymentUrl,
        status: attempt.status,
        isNew: true,
      };
    });
  }

  private async finalizeVerifiedPayment(attemptId: string, authority: string, referenceId: string) {
    return this.prisma.$transaction(async (transaction) => {
      const attempt = await transaction.paymentAttempt.findUnique({
        where: {
          id: attemptId,
        },
        include: {
          payment: {
            include: {
              order: {
                include: {
                  items: true,
                },
              },
            },
          },
        },
      });

      if (!attempt) {
        throw new NotFoundException('Payment attempt was not found.');
      }

      if (attempt.authority !== authority) {
        throw new BadRequestException('Payment authority does not match.');
      }

      const order = attempt.payment.order;

      if (
        attempt.status === PaymentAttemptStatus.VERIFIED ||
        attempt.payment.status === PaymentStatus.PAID ||
        order.status === OrderStatus.PAID
      ) {
        return {
          success: true,
          alreadyVerified: true,
          orderId: order.id,
          referenceId: attempt.providerReference ?? referenceId,
        };
      }

      if (order.status !== OrderStatus.PENDING_PAYMENT) {
        throw new ConflictException('Order can no longer be marked as paid.');
      }

      const paidAt = new Date();
      const claimed = await transaction.order.updateMany({
        where: {
          id: order.id,
          status: OrderStatus.PENDING_PAYMENT,
        },
        data: {
          status: OrderStatus.PAID,
          paidAt,
        },
      });

      if (claimed.count !== 1) {
        const currentOrder = await transaction.order.findUnique({
          where: {
            id: order.id,
          },
          select: {
            status: true,
          },
        });

        if (currentOrder?.status === OrderStatus.PAID) {
          return {
            success: true,
            alreadyVerified: true,
            orderId: order.id,
            referenceId,
          };
        }

        throw new ConflictException('Order status changed during payment verification.');
      }

      await this.commitReservedInventory(transaction, order.warehouseId, order.id, order.items);

      await transaction.orderStatusHistory.create({
        data: {
          orderId: order.id,
          actorUserId: null,
          fromStatus: OrderStatus.PENDING_PAYMENT,
          toStatus: OrderStatus.PAID,
          reason: 'Payment verified',
        },
      });

      await transaction.payment.update({
        where: {
          id: attempt.paymentId,
        },
        data: {
          status: PaymentStatus.PAID,
          paidAt,
        },
      });

      await transaction.paymentAttempt.update({
        where: {
          id: attempt.id,
        },
        data: {
          status: PaymentAttemptStatus.VERIFIED,
          providerReference: referenceId,
          verifiedAt: paidAt,
          failureCode: null,
          failureMessage: null,
        },
      });

      return {
        success: true,
        alreadyVerified: false,
        orderId: order.id,
        referenceId,
      };
    });
  }

  private async commitReservedInventory(
    transaction: Prisma.TransactionClient,
    warehouseId: string,
    orderId: string,
    items: Array<{ variantId: string; quantity: number }>,
  ): Promise<void> {
    const quantitiesByVariant = new Map<string, number>();

    for (const item of items) {
      quantitiesByVariant.set(
        item.variantId,
        (quantitiesByVariant.get(item.variantId) ?? 0) + item.quantity,
      );
    }

    for (const [variantId, quantity] of quantitiesByVariant) {
      const inventory = await transaction.inventory.findUnique({
        where: {
          warehouseId_variantId: {
            warehouseId,
            variantId,
          },
        },
      });

      if (!inventory || inventory.reserved < quantity || inventory.onHand < quantity) {
        throw new ConflictException('Reserved inventory is inconsistent.');
      }

      const nextOnHand = inventory.onHand - quantity;
      const nextReserved = inventory.reserved - quantity;
      const updated = await transaction.inventory.updateMany({
        where: {
          id: inventory.id,
          onHand: inventory.onHand,
          reserved: inventory.reserved,
        },
        data: {
          onHand: nextOnHand,
          reserved: nextReserved,
        },
      });

      if (updated.count !== 1) {
        throw new ConflictException('Inventory changed; payment finalization must retry.');
      }

      await transaction.inventoryMovement.create({
        data: {
          inventoryId: inventory.id,
          actorUserId: null,
          type: InventoryMovementType.SALE,
          onHandDelta: -quantity,
          reservedDelta: -quantity,
          onHandAfter: nextOnHand,
          reservedAfter: nextReserved,
          reason: 'Payment verified',
          referenceType: 'ORDER',
          referenceId: orderId,
        },
      });
    }
  }

  private tomanToRial(amountToman: number): string {
    if (!Number.isSafeInteger(amountToman) || amountToman < 0) {
      throw new BadRequestException('Payment amount is invalid.');
    }

    return (BigInt(amountToman) * 10n).toString();
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
  }
}
