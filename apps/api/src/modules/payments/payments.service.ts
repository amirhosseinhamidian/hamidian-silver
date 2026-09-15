import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DomainException } from '../../common/errors/domain-exception';
import { ErrorCode } from '../../common/errors/error-codes';
import { lockOrderRowForUpdate } from '../../common/order-row-lock';
import { isNonNegativeTomanInt } from '../../common/toman';
import type { Prisma } from '../../generated/prisma/client';
import {
  InventoryMovementType,
  NotificationOutboxEventType,
  OrderCostEntryType,
  OrderStatus,
  PaymentAttemptStatus,
  PaymentReconciliationStatus,
  PaymentStatus,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { OrderCostsService } from '../finance/order-costs.service';
import { OrderFinanceService } from '../finance/order-finance.service';
import { NotificationOutboxService } from '../notifications/notification-outbox.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { PAYMENT_GATEWAY_CODES } from './payment-gateway.constants';
import { isPaymentInitiationUnknownError } from './payment-initiation-unknown.error';
import {
  PAYMENT_GATEWAY,
  type InitiateGatewayPaymentInput,
  type PaymentGateway,
  type VerifyGatewayPaymentInput,
} from './payment-gateway.port';

const CARD_TO_CARD_PROVIDER = 'card_to_card';
const MAX_RECEIPT_SIZE_BYTES = 10 * 1024 * 1024;
const RECEIPT_REVIEW_HOLD_MS = 7 * 24 * 60 * 60 * 1000;

export type PaymentReceiptUpload = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

type InitiationContext = {
  attemptId: string;
  orderNumber: string;
  amountToman: number;
  authority?: string | null;
  paymentUrl?: string | null;
  status: PaymentAttemptStatus;
  provider: string;
  isNew: boolean;
};

@Injectable()
export class PaymentsService {
  private readonly callbackBaseUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
    @Inject(NotificationOutboxService)
    private readonly outbox?: NotificationOutboxService,
    @Inject(OrderFinanceService)
    private readonly orderFinance: OrderFinanceService | undefined = undefined,
    @Optional()
    @Inject(OrderCostsService)
    private readonly orderCosts: OrderCostsService | undefined = undefined,
  ) {
    this.callbackBaseUrl = this.config.get<string>(
      'PAYMENT_CALLBACK_URL',
      'http://localhost:3000/api/v1/payments/callback',
    );
  }

  async initiateOrderPayment(userId: string, orderId: string, dto: InitiatePaymentDto) {
    const requestedProvider = dto.provider;
    const provider =
      this.gateway.providerCode === 'registry'
        ? (requestedProvider ?? PAYMENT_GATEWAY_CODES.ZARINPAL)
        : this.gateway.providerCode;
    let context: InitiationContext;

    try {
      context = await this.createOrLoadAttempt(userId, orderId, dto.idempotencyKey, provider);
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
        existing.payment.order.userId !== userId ||
        (existing.provider && existing.provider !== provider)
      ) {
        throw new DomainException(ErrorCode.PAYMENT_FAILED, 'Idempotency key is already in use.');
      }

      context = {
        attemptId: existing.id,
        orderNumber: existing.payment.order.orderNumber,
        amountToman: existing.amountToman,
        authority: existing.authority,
        paymentUrl: existing.paymentUrl,
        status: existing.status,
        provider: existing.provider ?? provider,
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

    if (context.status === PaymentAttemptStatus.RECONCILIATION_REQUIRED) {
      return {
        attemptId: context.attemptId,
        status: context.status,
        reconciliationRequired: true,
      };
    }

    if (context.status === PaymentAttemptStatus.RECONCILED) {
      return {
        attemptId: context.attemptId,
        status: context.status,
        reconciled: true,
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
      throw new DomainException(
        ErrorCode.PAYMENT_FAILED,
        'This idempotency key belongs to a failed payment attempt. Use a new key.',
      );
    }

    if (!context.isNew && context.status === PaymentAttemptStatus.CREATED) {
      throw new DomainException(
        ErrorCode.PAYMENT_FAILED,
        'Payment attempt is still being initialized.',
      );
    }

    const callbackUrl = `${this.callbackBaseUrl}/${context.attemptId}`;

    const gatewayInput: InitiateGatewayPaymentInput = {
      attemptId: context.attemptId,
      orderNumber: context.orderNumber,
      amountRial: this.tomanToRial(context.amountToman),
      callbackUrl,
    };

    if (this.gateway.providerCode === 'registry') {
      gatewayInput.provider = context.provider;
    }

    let initiated: Awaited<ReturnType<PaymentGateway['initiate']>>;

    try {
      initiated = await this.gateway.initiate(gatewayInput);
    } catch (error) {
      if (!isPaymentInitiationUnknownError(error)) {
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
      }

      throw error;
    }

    this.assertGatewayInitiationResult(initiated);

    const persisted = await this.prisma.paymentAttempt.updateMany({
      where: {
        id: context.attemptId,
        status: PaymentAttemptStatus.CREATED,
      },
      data: {
        authority: initiated.authority,
        paymentUrl: initiated.paymentUrl,
        status: PaymentAttemptStatus.REDIRECTED,
        failureMessage: null,
      },
    });

    if (persisted.count === 1) {
      return {
        attemptId: context.attemptId,
        status: PaymentAttemptStatus.REDIRECTED,
        authority: initiated.authority,
        paymentUrl: initiated.paymentUrl,
      };
    }

    const current = await this.prisma.paymentAttempt.findUnique({
      where: {
        id: context.attemptId,
      },
    });

    if (
      current?.status === PaymentAttemptStatus.REDIRECTED &&
      current.authority === initiated.authority &&
      current.paymentUrl === initiated.paymentUrl
    ) {
      return {
        attemptId: current.id,
        status: current.status,
        authority: current.authority,
        paymentUrl: current.paymentUrl,
      };
    }

    if (current?.status === PaymentAttemptStatus.VERIFIED) {
      return {
        attemptId: current.id,
        status: current.status,
        alreadyPaid: true,
      };
    }

    if (current?.status === PaymentAttemptStatus.RECONCILIATION_REQUIRED) {
      return {
        attemptId: current.id,
        status: current.status,
        reconciliationRequired: true,
      };
    }

    if (current?.status === PaymentAttemptStatus.RECONCILED) {
      return {
        attemptId: current.id,
        status: current.status,
        reconciled: true,
      };
    }

    throw new DomainException(
      ErrorCode.PAYMENT_FAILED,
      'Payment attempt state changed while storing the gateway initiation result.',
    );
  }

  async verifyCallback(
    attemptId: string,
    authority: string,
    callbackData?: Record<string, string>,
  ) {
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
      throw new DomainException(ErrorCode.PAYMENT_NOT_FOUND, 'Payment attempt was not found.');
    }

    if (attempt.status === PaymentAttemptStatus.VERIFIED) {
      return {
        success: true,
        alreadyVerified: true,
        orderId: attempt.payment.orderId,
        referenceId: attempt.providerReference,
      };
    }

    if (attempt.status === PaymentAttemptStatus.RECONCILIATION_REQUIRED) {
      return {
        success: true,
        reconciliationRequired: true,
        orderId: attempt.payment.orderId,
        referenceId: attempt.providerReference,
      };
    }

    if (attempt.status === PaymentAttemptStatus.RECONCILED) {
      return {
        success: true,
        reconciled: true,
        orderId: attempt.payment.orderId,
        referenceId: attempt.providerReference,
      };
    }

    if (!attempt.authority || attempt.authority !== authority) {
      throw new DomainException(
        ErrorCode.PAYMENT_CALLBACK_INVALID,
        'Payment authority does not match.',
      );
    }

    const gatewayInput: VerifyGatewayPaymentInput & {
      callbackData?: Record<string, string>;
    } = {
      authority,
      amountRial: this.tomanToRial(attempt.amountToman),
    };

    if (callbackData) {
      gatewayInput.callbackData = callbackData;
    }

    if (this.gateway.providerCode === 'registry') {
      gatewayInput.provider = attempt.provider;
    }

    const verification = await this.gateway.verify(gatewayInput);

    if (!verification.success) {
      this.assertGatewayFailureResult(verification.code, verification.message);

      const failed = await this.prisma.paymentAttempt.updateMany({
        where: {
          id: attempt.id,
          status: attempt.status,
        },
        data: {
          status: PaymentAttemptStatus.FAILED,
          failureCode: verification.code,
          failureMessage: verification.message ?? 'Payment verification failed.',
        },
      });

      if (failed.count === 1) {
        throw new DomainException(ErrorCode.PAYMENT_FAILED, 'Payment verification failed.');
      }

      const current = await this.prisma.paymentAttempt.findUnique({
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

      if (current?.status === PaymentAttemptStatus.VERIFIED) {
        return {
          success: true,
          alreadyVerified: true,
          orderId: current.payment.orderId,
          referenceId: current.providerReference,
        };
      }

      if (current?.status === PaymentAttemptStatus.RECONCILIATION_REQUIRED) {
        return {
          success: true,
          reconciliationRequired: true,
          orderId: current.payment.orderId,
          referenceId: current.providerReference,
        };
      }

      if (current?.status === PaymentAttemptStatus.RECONCILED) {
        return {
          success: true,
          reconciled: true,
          orderId: current.payment.orderId,
          referenceId: current.providerReference,
        };
      }

      throw new DomainException(
        ErrorCode.PAYMENT_FAILED,
        'Payment attempt state changed while processing a verification failure.',
      );
    }

    this.assertGatewayVerificationResult(verification.referenceId, verification.actualFeeToman);

    try {
      return await this.finalizeVerifiedPayment(
        attempt.id,
        authority,
        verification.referenceId,
        verification.actualFeeToman,
      );
    } catch (error) {
      if (!(error instanceof ConflictException)) {
        throw error;
      }

      return this.recordPaymentReconciliation(
        attempt.id,
        verification.referenceId,
        this.conflictMessage(error),
      );
    }
  }

  getCardToCardSettings() {
    const enabled = this.config.get<boolean>('CARD_TO_CARD_ENABLED', false);
    const cardNumber = this.config.get<string>('CARD_TO_CARD_NUMBER')?.trim() ?? '';
    const holderName = this.config.get<string>('CARD_TO_CARD_HOLDER_NAME')?.trim() ?? '';
    const bankName = this.config.get<string>('CARD_TO_CARD_BANK_NAME')?.trim() ?? '';
    const configured =
      enabled && /^\d{16}$/.test(cardNumber) && holderName.length >= 2 && bankName.length >= 2;

    return {
      enabled: configured,
      cardNumber: configured ? cardNumber : null,
      holderName: configured ? holderName : null,
      bankName: configured ? bankName : null,
    };
  }

  async submitCardToCardReceipt(
    userId: string,
    orderId: string,
    idempotencyKey: string,
    file?: PaymentReceiptUpload,
  ) {
    if (!this.getCardToCardSettings().enabled) {
      throw new ConflictException('Card-to-card payment is not available.');
    }

    const receipt = this.validatePaymentReceipt(file);

    return this.prisma.$transaction(async (transaction) => {
      await lockOrderRowForUpdate(transaction, orderId);

      const order = await transaction.order.findFirst({
        where: { id: orderId, userId },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          grandTotalToman: true,
          reservationExpiresAt: true,
        },
      });

      if (!order) {
        throw new DomainException(ErrorCode.ORDER_NOT_FOUND, 'Order was not found.');
      }
      if (order.status !== OrderStatus.PENDING_PAYMENT) {
        throw new ConflictException('Order is not awaiting payment.');
      }
      if (order.reservationExpiresAt <= new Date()) {
        throw new ConflictException('Order inventory reservation has expired.');
      }

      const payment = await transaction.payment.upsert({
        where: { orderId: order.id },
        update: {},
        create: {
          orderId: order.id,
          amountToman: order.grandTotalToman,
        },
      });

      if (payment.status !== PaymentStatus.PENDING) {
        throw new ConflictException('Payment is not pending.');
      }
      if (payment.amountToman !== order.grandTotalToman) {
        throw new ConflictException('Order and payment amounts do not match.');
      }

      const existingForOrder = await transaction.paymentAttempt.findFirst({
        where: {
          paymentId: payment.id,
          provider: CARD_TO_CARD_PROVIDER,
          status: {
            in: [PaymentAttemptStatus.AWAITING_REVIEW, PaymentAttemptStatus.VERIFIED],
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (existingForOrder) {
        return {
          attemptId: existingForOrder.id,
          orderId: order.id,
          orderNumber: order.orderNumber,
          status: existingForOrder.status,
          receiptUploadedAt: existingForOrder.receiptUploadedAt,
          alreadySubmitted: true,
        };
      }

      const existingKey = await transaction.paymentAttempt.findUnique({
        where: { idempotencyKey },
      });

      if (existingKey) {
        if (
          existingKey.paymentId !== payment.id ||
          existingKey.provider !== CARD_TO_CARD_PROVIDER
        ) {
          throw new ConflictException('Idempotency key is already in use.');
        }

        return {
          attemptId: existingKey.id,
          orderId: order.id,
          orderNumber: order.orderNumber,
          status: existingKey.status,
          receiptUploadedAt: existingKey.receiptUploadedAt,
          alreadySubmitted: true,
        };
      }

      await transaction.paymentAttempt.updateMany({
        where: {
          paymentId: payment.id,
          provider: { not: CARD_TO_CARD_PROVIDER },
          status: {
            in: [PaymentAttemptStatus.CREATED, PaymentAttemptStatus.REDIRECTED],
          },
        },
        data: {
          status: PaymentAttemptStatus.FAILED,
          failureCode: 'PAYMENT_METHOD_CHANGED',
          failureMessage: 'Payment method changed to card-to-card.',
        },
      });

      const uploadedAt = new Date();
      const attempt = await transaction.paymentAttempt.create({
        data: {
          paymentId: payment.id,
          idempotencyKey,
          provider: CARD_TO_CARD_PROVIDER,
          status: PaymentAttemptStatus.AWAITING_REVIEW,
          amountToman: payment.amountToman,
          receiptData: Uint8Array.from(receipt.buffer),
          receiptMimeType: receipt.mimeType,
          receiptOriginalName: receipt.originalName,
          receiptSizeBytes: receipt.size,
          receiptUploadedAt: uploadedAt,
        },
      });

      await transaction.order.update({
        where: { id: order.id },
        data: {
          reservationExpiresAt: new Date(uploadedAt.getTime() + RECEIPT_REVIEW_HOLD_MS),
        },
      });

      await this.outbox?.enqueueOrderEvent(transaction, {
        type: NotificationOutboxEventType.PAYMENT_RECEIPT_SUBMITTED,
        orderId: order.id,
        deduplicationKey: `payment-attempt:${attempt.id}:receipt-submitted`,
        payload: {
          paymentAttemptId: attempt.id,
          provider: CARD_TO_CARD_PROVIDER,
        },
      });

      return {
        attemptId: attempt.id,
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: attempt.status,
        receiptUploadedAt: uploadedAt,
        alreadySubmitted: false,
      };
    });
  }

  async getCardToCardReceipt(attemptId: string) {
    const attempt = await this.prisma.paymentAttempt.findUnique({
      where: { id: attemptId },
      select: {
        provider: true,
        receiptData: true,
        receiptMimeType: true,
        receiptOriginalName: true,
      },
    });

    if (
      !attempt ||
      attempt.provider !== CARD_TO_CARD_PROVIDER ||
      !attempt.receiptData ||
      !attempt.receiptMimeType ||
      !attempt.receiptOriginalName
    ) {
      throw new NotFoundException('Payment receipt was not found.');
    }

    return {
      data: Buffer.from(attempt.receiptData),
      mimeType: attempt.receiptMimeType,
      originalName: attempt.receiptOriginalName,
    };
  }

  async confirmCardToCardReceipt(attemptId: string, actorUserId: string) {
    const attempt = await this.prisma.paymentAttempt.findUnique({
      where: { id: attemptId },
      select: {
        id: true,
        provider: true,
        status: true,
        receiptData: true,
        payment: {
          select: {
            order: {
              select: { orderNumber: true },
            },
          },
        },
      },
    });

    if (!attempt || attempt.provider !== CARD_TO_CARD_PROVIDER || !attempt.receiptData) {
      throw new NotFoundException('Payment receipt was not found.');
    }

    if (attempt.status === PaymentAttemptStatus.VERIFIED) {
      return { success: true, alreadyVerified: true };
    }

    if (attempt.status !== PaymentAttemptStatus.AWAITING_REVIEW) {
      throw new ConflictException('Payment receipt is not awaiting review.');
    }

    const referenceId =
      `CARD-${attempt.payment.order.orderNumber}-` + attempt.id.slice(0, 8).toUpperCase();

    return this.finalizeVerifiedPayment(attempt.id, null, referenceId, undefined, actorUserId);
  }

  async getOrderPayment(userId: string, orderId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: {
        orderId,
        order: {
          userId,
        },
      },
      select: {
        id: true,
        orderId: true,
        status: true,
        amountToman: true,
        refundedAmountToman: true,
        paidAt: true,
        createdAt: true,
        updatedAt: true,
        attempts: {
          orderBy: {
            createdAt: 'desc',
          },
          select: {
            id: true,
            provider: true,
            status: true,
            amountToman: true,
            providerReference: true,
            verifiedAt: true,
            createdAt: true,
          },
        },
        refunds: {
          orderBy: {
            createdAt: 'desc',
          },
          select: {
            id: true,
            status: true,
            amountToman: true,
            confirmedAt: true,
            cancelledAt: true,
            createdAt: true,
          },
        },
      },
    });

    if (!payment) {
      throw new DomainException(ErrorCode.PAYMENT_NOT_FOUND, 'Payment was not found.');
    }

    return payment;
  }

  private async createOrLoadAttempt(
    userId: string,
    orderId: string,
    idempotencyKey: string,
    provider: string,
  ): Promise<InitiationContext> {
    return this.prisma.$transaction(async (transaction) => {
      await lockOrderRowForUpdate(transaction, orderId);

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
        throw new DomainException(ErrorCode.ORDER_NOT_FOUND, 'Order was not found.');
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
            provider: paidAttempt.provider ?? provider,
            isNew: false,
          };
        }

        throw new DomainException(ErrorCode.PAYMENT_ALREADY_CONFIRMED, 'Order is already paid.');
      }

      if (order.status !== OrderStatus.PENDING_PAYMENT) {
        throw new DomainException(ErrorCode.PAYMENT_FAILED, 'Order is not payable.');
      }

      if (order.reservationExpiresAt <= new Date()) {
        throw new DomainException(
          ErrorCode.PAYMENT_FAILED,
          'Order inventory reservation has expired.',
        );
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
        throw new DomainException(
          ErrorCode.PAYMENT_FAILED,
          'Order total no longer matches payment amount.',
        );
      }

      const existing = await transaction.paymentAttempt.findUnique({
        where: {
          idempotencyKey,
        },
      });

      if (existing) {
        if (
          existing.paymentId !== payment.id ||
          (existing.provider && existing.provider !== provider)
        ) {
          throw new DomainException(ErrorCode.PAYMENT_FAILED, 'Idempotency key is already in use.');
        }

        return {
          attemptId: existing.id,
          orderNumber: order.orderNumber,
          amountToman: existing.amountToman,
          authority: existing.authority,
          paymentUrl: existing.paymentUrl,
          status: existing.status,
          provider: existing.provider ?? provider,
          isNew: false,
        };
      }

      const attempt = await transaction.paymentAttempt.create({
        data: {
          paymentId: payment.id,
          idempotencyKey,
          provider,
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
        provider,
        isNew: true,
      };
    });
  }

  private async finalizeVerifiedPayment(
    attemptId: string,
    authority: string | null,
    referenceId: string,
    actualFeeToman?: number,
    actorUserId: string | null = null,
  ) {
    const isManualReceipt = authority === null;
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
        throw new DomainException(ErrorCode.PAYMENT_NOT_FOUND, 'Payment attempt was not found.');
      }

      if (!isManualReceipt && attempt.authority !== authority) {
        throw new DomainException(
          ErrorCode.PAYMENT_CALLBACK_INVALID,
          'Payment authority does not match.',
        );
      }

      const order = attempt.payment.order;

      if (attempt.status === PaymentAttemptStatus.VERIFIED) {
        return {
          success: true,
          alreadyVerified: true,
          orderId: order.id,
          referenceId: attempt.providerReference ?? referenceId,
        };
      }

      const expectedStatus = isManualReceipt
        ? PaymentAttemptStatus.AWAITING_REVIEW
        : PaymentAttemptStatus.REDIRECTED;

      if (
        isManualReceipt &&
        (attempt.provider !== CARD_TO_CARD_PROVIDER ||
          !attempt.receiptData ||
          !attempt.receiptUploadedAt)
      ) {
        throw new ConflictException('Card-to-card receipt metadata is incomplete.');
      }

      if (attempt.status !== expectedStatus) {
        if (isManualReceipt) {
          throw new ConflictException(`Payment attempt reached ${attempt.status}.`);
        }
        return this.recordPaymentReconciliationInTransaction(
          transaction,
          attempt.id,
          referenceId,
          `Gateway verification completed after payment attempt reached ${attempt.status}.`,
        );
      }

      if (order.status !== OrderStatus.PENDING_PAYMENT) {
        if (isManualReceipt) {
          throw new ConflictException(`Order reached ${order.status}.`);
        }
        return this.recordPaymentReconciliationInTransaction(
          transaction,
          attempt.id,
          referenceId,
          `Gateway verified payment after order reached ${order.status}.`,
        );
      }

      if (attempt.payment.status !== PaymentStatus.PENDING) {
        if (isManualReceipt) {
          throw new ConflictException(`Payment reached ${attempt.payment.status}.`);
        }
        return this.recordPaymentReconciliationInTransaction(
          transaction,
          attempt.id,
          referenceId,
          `Gateway verified payment while payment aggregate was ${attempt.payment.status}.`,
        );
      }

      if (
        attempt.amountToman !== attempt.payment.amountToman ||
        attempt.payment.amountToman !== order.grandTotalToman
      ) {
        if (isManualReceipt) {
          throw new ConflictException('Payment amount snapshots do not match.');
        }
        return this.recordPaymentReconciliationInTransaction(
          transaction,
          attempt.id,
          referenceId,
          'Verified payment amount snapshots do not match the Payment and Order totals.',
        );
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
        if (isManualReceipt) {
          throw new ConflictException('Order status changed during receipt confirmation.');
        }
        return this.recordPaymentReconciliationInTransaction(
          transaction,
          attempt.id,
          referenceId,
          'Order status changed during payment verification.',
        );
      }

      await this.commitReservedInventory(transaction, order.warehouseId, order.id, order.items);

      await transaction.orderStatusHistory.create({
        data: {
          orderId: order.id,
          actorUserId: null,
          fromStatus: OrderStatus.PENDING_PAYMENT,
          toStatus: OrderStatus.PAID,
          reason: isManualReceipt ? 'Card-to-card receipt approved' : 'Payment verified',
        },
      });

      const attemptFinalized = await transaction.paymentAttempt.updateMany({
        where: {
          id: attempt.id,
          status: attempt.status,
        },
        data: {
          status: PaymentAttemptStatus.VERIFIED,
          providerReference: referenceId,
          verifiedAt: paidAt,
          failureCode: null,
          failureMessage: null,
          receiptVerifiedByUserId: isManualReceipt ? actorUserId : undefined,
        },
      });

      if (attemptFinalized.count !== 1) {
        throw new ConflictException('Payment attempt state changed during finalization.');
      }

      const paymentFinalized = await transaction.payment.updateMany({
        where: {
          id: attempt.paymentId,
          status: attempt.payment.status,
        },
        data: {
          status: PaymentStatus.PAID,
          paidAt,
        },
      });

      if (paymentFinalized.count !== 1) {
        throw new ConflictException('Payment state changed during finalization.');
      }

      await this.createSupplierPayables(transaction, order.id, order.items);

      await this.orderFinance?.createSnapshot(transaction, {
        orderId: order.id,
        paidAt,
        merchandiseTotalToman: order.merchandiseTotalToman,
        platingTotalToman: order.platingTotalToman,
        discountTotalToman: order.discountTotalToman,
        shippingTotalToman: order.shippingTotalToman,
        taxTotalToman: order.taxTotalToman,
        grandTotalToman: order.grandTotalToman,
        items: order.items,
      });

      if (actualFeeToman !== undefined) {
        await this.orderCosts?.recordActualCost(transaction, {
          orderId: order.id,
          type: OrderCostEntryType.PAYMENT_GATEWAY_FEE,
          amountToman: actualFeeToman,
          source: attempt.provider,
          externalReference: referenceId,
          idempotencyKey: `payment-attempt:${attempt.id}:gateway-fee`,
          occurredAt: paidAt,
          description: 'Actual payment gateway fee reported during verification',
        });
      }

      await this.outbox?.enqueueOrderEvent(transaction, {
        type: NotificationOutboxEventType.PAYMENT_VERIFIED,
        orderId: order.id,
        deduplicationKey: `order:${order.id}:payment-verified`,
        payload: {
          paymentAttemptId: attempt.id,
          provider: attempt.provider,
          providerReference: referenceId,
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

  private validatePaymentReceipt(file?: PaymentReceiptUpload) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Payment receipt image is required.');
    }
    if (
      !Number.isSafeInteger(file.size) ||
      file.size <= 0 ||
      file.size > MAX_RECEIPT_SIZE_BYTES ||
      file.size !== file.buffer.length
    ) {
      throw new BadRequestException('Receipt image must be smaller than 10 MB.');
    }

    const isJpeg = file.buffer[0] === 0xff && file.buffer[1] === 0xd8 && file.buffer[2] === 0xff;
    const isPng = file.buffer
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const isWebp =
      file.buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      file.buffer.subarray(8, 12).toString('ascii') === 'WEBP';

    const detectedMimeType = isJpeg
      ? 'image/jpeg'
      : isPng
        ? 'image/png'
        : isWebp
          ? 'image/webp'
          : null;

    if (!detectedMimeType || detectedMimeType !== file.mimetype.toLowerCase()) {
      throw new BadRequestException('Only valid JPEG, PNG, or WebP receipts are accepted.');
    }

    const originalName =
      file.originalname
        .replace(/[\u0000-\u001f\u007f/\\]/g, '')
        .trim()
        .slice(0, 255) || `receipt.${detectedMimeType.split('/')[1]}`;

    return {
      buffer: file.buffer,
      size: file.size,
      mimeType: detectedMimeType,
      originalName,
    };
  }

  private recordPaymentReconciliation(attemptId: string, referenceId: string, reason: string) {
    return this.prisma.$transaction((transaction) =>
      this.recordPaymentReconciliationInTransaction(transaction, attemptId, referenceId, reason),
    );
  }

  private async recordPaymentReconciliationInTransaction(
    transaction: Prisma.TransactionClient,
    attemptId: string,
    referenceId: string,
    reason: string,
  ) {
    const attempt = await transaction.paymentAttempt.findUnique({
      where: {
        id: attemptId,
      },
      include: {
        reconciliation: true,
        payment: {
          include: {
            order: {
              select: {
                id: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!attempt) {
      throw new DomainException(ErrorCode.PAYMENT_NOT_FOUND, 'Payment attempt was not found.');
    }

    if (attempt.status === PaymentAttemptStatus.VERIFIED) {
      return {
        success: true,
        alreadyVerified: true,
        orderId: attempt.payment.orderId,
        referenceId: attempt.providerReference ?? referenceId,
      };
    }

    if (
      attempt.reconciliation?.status === PaymentReconciliationStatus.RESOLVED ||
      attempt.status === PaymentAttemptStatus.RECONCILED
    ) {
      return {
        success: true,
        reconciled: true,
        orderId: attempt.payment.orderId,
        referenceId: attempt.providerReference ?? referenceId,
      };
    }

    if (
      attempt.reconciliation?.status === PaymentReconciliationStatus.OPEN &&
      attempt.status === PaymentAttemptStatus.RECONCILIATION_REQUIRED
    ) {
      return {
        success: true,
        reconciliationRequired: true,
        reconciliationId: attempt.reconciliation.id,
        orderId: attempt.payment.orderId,
        referenceId: attempt.providerReference ?? referenceId,
      };
    }

    const preserveSettledPayment =
      attempt.payment.status === PaymentStatus.PAID ||
      attempt.payment.status === PaymentStatus.PARTIALLY_REFUNDED ||
      attempt.payment.status === PaymentStatus.REFUNDED;

    const verifiedAt = attempt.verifiedAt ?? new Date();
    const attemptClaimed = await transaction.paymentAttempt.updateMany({
      where: {
        id: attempt.id,
        status: attempt.status,
      },
      data: {
        status: PaymentAttemptStatus.RECONCILIATION_REQUIRED,
        providerReference: referenceId,
        verifiedAt,
        failureCode: null,
        failureMessage: null,
      },
    });

    if (attemptClaimed.count !== 1) {
      const current = await transaction.paymentAttempt.findUnique({
        where: {
          id: attempt.id,
        },
        include: {
          reconciliation: true,
          payment: {
            include: {
              order: {
                select: {
                  id: true,
                  status: true,
                },
              },
            },
          },
        },
      });

      if (current?.status === PaymentAttemptStatus.VERIFIED) {
        return {
          success: true,
          alreadyVerified: true,
          orderId: current.payment.orderId,
          referenceId: current.providerReference ?? referenceId,
        };
      }

      if (
        current?.reconciliation?.status === PaymentReconciliationStatus.OPEN &&
        current.status === PaymentAttemptStatus.RECONCILIATION_REQUIRED
      ) {
        return {
          success: true,
          reconciliationRequired: true,
          reconciliationId: current.reconciliation.id,
          orderId: current.payment.orderId,
          referenceId: current.providerReference ?? referenceId,
        };
      }

      if (
        current?.reconciliation?.status === PaymentReconciliationStatus.RESOLVED ||
        current?.status === PaymentAttemptStatus.RECONCILED
      ) {
        return {
          success: true,
          reconciled: true,
          orderId: current.payment.orderId,
          referenceId: current.providerReference ?? referenceId,
        };
      }

      throw new DomainException(
        ErrorCode.PAYMENT_FAILED,
        'Payment attempt state changed while recording reconciliation.',
      );
    }

    if (!preserveSettledPayment) {
      const paymentClaimed = await transaction.payment.updateMany({
        where: {
          id: attempt.paymentId,
          status: attempt.payment.status,
        },
        data: {
          status: PaymentStatus.RECONCILIATION_REQUIRED,
        },
      });

      if (paymentClaimed.count !== 1) {
        throw new DomainException(
          ErrorCode.PAYMENT_FAILED,
          'Payment state changed while recording reconciliation.',
        );
      }
    }

    const reconciliation = await transaction.paymentReconciliation.upsert({
      where: {
        paymentAttemptId: attempt.id,
      },
      update: {
        providerReference: referenceId,
        reason,
      },
      create: {
        paymentAttemptId: attempt.id,
        provider: attempt.provider,
        providerReference: referenceId,
        amountToman: attempt.amountToman,
        detectedOrderStatus: attempt.payment.order.status,
        reason,
      },
    });

    await this.outbox?.enqueueOrderEvent(transaction, {
      type: NotificationOutboxEventType.PAYMENT_RECONCILIATION_REQUIRED,
      orderId: attempt.payment.orderId,
      deduplicationKey: `payment-attempt:${attempt.id}:reconciliation-required`,
      payload: {
        paymentAttemptId: attempt.id,
        provider: attempt.provider,
        providerReference: referenceId,
      },
    });

    return {
      success: true,
      reconciliationRequired: true,
      reconciliationId: reconciliation.id,
      orderId: attempt.payment.orderId,
      referenceId,
    };
  }

  private conflictMessage(error: ConflictException): string {
    const response = error.getResponse();

    if (typeof response === 'string') {
      return response.slice(0, 500);
    }

    if (typeof response === 'object' && response !== null && 'message' in response) {
      const message = (response as { message?: unknown }).message;

      if (typeof message === 'string') {
        return message.slice(0, 500);
      }

      if (Array.isArray(message)) {
        return message.join('; ').slice(0, 500);
      }
    }

    return 'Payment was verified by the gateway but could not be finalized.';
  }

  private async createSupplierPayables(
    transaction: Prisma.TransactionClient,
    orderId: string,
    items: Array<{
      id: string;
      quantity: number;
      unitSupplierPriceToman: number | null;
      supplierIdSnapshot: string | null;
      supplierNameSnapshot: string | null;
    }>,
  ): Promise<void> {
    const rows = items.flatMap((item) => {
      const unitSupplierPriceToman = item.unitSupplierPriceToman ?? null;
      const supplierIdSnapshot = item.supplierIdSnapshot ?? null;
      const supplierNameSnapshot = item.supplierNameSnapshot ?? null;
      const hasAnySupplierSnapshot =
        unitSupplierPriceToman !== null ||
        supplierIdSnapshot !== null ||
        supplierNameSnapshot !== null;

      if (!hasAnySupplierSnapshot) {
        return [];
      }

      if (
        unitSupplierPriceToman === null ||
        supplierIdSnapshot === null ||
        supplierNameSnapshot === null
      ) {
        throw new ConflictException('Supplier snapshot is incomplete for a paid order item.');
      }

      const amountToman = unitSupplierPriceToman * item.quantity;

      if (!isNonNegativeTomanInt(amountToman)) {
        throw new ConflictException('Supplier payable amount exceeds the supported range.');
      }

      return [
        {
          orderId,
          orderItemId: item.id,
          supplierIdSnapshot,
          supplierNameSnapshot,
          quantity: item.quantity,
          unitSupplierPriceToman,
          amountToman,
        },
      ];
    });

    if (rows.length === 0) {
      return;
    }

    await transaction.supplierPayable.createMany({
      data: rows,
      skipDuplicates: true,
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

  private assertGatewayInitiationResult(
    result: Awaited<ReturnType<PaymentGateway['initiate']>>,
  ): void {
    this.assertGatewayString(result.authority, 'Payment gateway authority', 255);
    this.assertGatewayString(result.paymentUrl, 'Payment gateway payment URL', 2000);

    let paymentUrl: URL;

    try {
      paymentUrl = new URL(result.paymentUrl);
    } catch {
      throw new BadGatewayException('Payment gateway payment URL is invalid.');
    }

    if (paymentUrl.protocol !== 'https:' && paymentUrl.protocol !== 'http:') {
      throw new BadGatewayException('Payment gateway payment URL is invalid.');
    }
  }

  private assertGatewayVerificationResult(referenceId: string, actualFeeToman?: number): void {
    this.assertGatewayString(referenceId, 'Payment gateway reference ID', 255);

    if (actualFeeToman !== undefined && !isNonNegativeTomanInt(actualFeeToman)) {
      throw new BadGatewayException('Payment gateway actual fee is invalid.');
    }
  }

  private assertGatewayFailureResult(code?: string, message?: string): void {
    if (code !== undefined) {
      this.assertGatewayString(code, 'Payment gateway failure code', 120);
    }

    if (message !== undefined) {
      this.assertGatewayString(message, 'Payment gateway failure message', 500);
    }
  }

  private assertGatewayString(value: string, label: string, maxLength: number): void {
    if (
      typeof value !== 'string' ||
      value.length === 0 ||
      value.length > maxLength ||
      value.trim() !== value
    ) {
      throw new BadGatewayException(`${label} is invalid.`);
    }
  }

  private tomanToRial(amountToman: number): string {
    if (!Number.isSafeInteger(amountToman) || amountToman < 0) {
      throw new DomainException(ErrorCode.PAYMENT_FAILED, 'Payment amount is invalid.');
    }

    return (BigInt(amountToman) * 10n).toString();
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
  }
}
