import { ConfigService } from '@nestjs/config';
import {
  NotificationOutboxEventType,
  OrderStatus,
  PaymentAttemptStatus,
  PaymentStatus,
} from '../../generated/prisma/enums';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import type { NotificationOutboxService } from '../notifications/notification-outbox.service';
import type { PaymentGateway } from './payment-gateway.port';
import { PaymentsService } from './payments.service';

describe('PaymentsService card-to-card receipt rejection', () => {
  it('reopens payment and queues a rejection SMS with the snapshotted reason', async () => {
    const attemptId = '40000000-0000-4000-8000-000000000001';
    const paymentId = '30000000-0000-4000-8000-000000000001';
    const orderId = '20000000-0000-4000-8000-000000000001';
    const actorUserId = '10000000-0000-4000-8000-000000000001';
    const transaction = {
      paymentAttempt: {
        findUnique: jest.fn().mockResolvedValue({
          id: attemptId,
          provider: 'card_to_card',
          status: PaymentAttemptStatus.AWAITING_REVIEW,
          receiptData: Uint8Array.from([1]),
          failureCode: null,
          paymentId,
          payment: {
            status: PaymentStatus.AWAITING_REVIEW,
            orderId,
            order: { status: OrderStatus.PENDING_PAYMENT },
          },
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      payment: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const outbox = {
      enqueueOrderEvent: jest.fn().mockResolvedValue({ count: 1 }),
    };
    const config = {
      get: jest.fn().mockReturnValue('https://api.example.com/api/v1/payments/callback'),
    };
    const gateway = { providerCode: 'test' };
    const service = new PaymentsService(
      prisma as unknown as PrismaService,
      config as unknown as ConfigService,
      gateway as PaymentGateway,
      outbox as unknown as NotificationOutboxService,
    );

    await expect(
      service.rejectCardToCardReceipt(
        attemptId,
        actorUserId,
        '  مبلغ واریزی با مبلغ سفارش مطابقت ندارد.  ',
      ),
    ).resolves.toEqual({ success: true, alreadyRejected: false });

    expect(transaction.paymentAttempt.updateMany).toHaveBeenCalledWith({
      where: { id: attemptId, status: PaymentAttemptStatus.AWAITING_REVIEW },
      data: {
        status: PaymentAttemptStatus.FAILED,
        failureCode: 'CARD_TO_CARD_RECEIPT_REJECTED',
        failureMessage: 'مبلغ واریزی با مبلغ سفارش مطابقت ندارد.',
      },
    });
    expect(transaction.payment.updateMany).toHaveBeenCalledWith({
      where: { id: paymentId, status: PaymentStatus.AWAITING_REVIEW },
      data: { status: PaymentStatus.PENDING },
    });
    expect(outbox.enqueueOrderEvent).toHaveBeenCalledWith(transaction, {
      type: NotificationOutboxEventType.PAYMENT_RECEIPT_REJECTED,
      orderId,
      deduplicationKey: `payment-attempt:${attemptId}:receipt-rejected`,
      payload: {
        paymentAttemptId: attemptId,
        reason: 'مبلغ واریزی با مبلغ سفارش مطابقت ندارد.',
        rejectedByUserId: actorUserId,
      },
    });
  });
});
