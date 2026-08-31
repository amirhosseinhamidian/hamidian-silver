import type { ConfigService } from '@nestjs/config';
import {
  NotificationOutboxEventType,
  NotificationOutboxStatus,
} from '../../generated/prisma/enums';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { SmsDeliveryUnknownError } from '../auth/sms-delivery-unknown.error';
import type { SmsSender } from '../auth/sms-sender.port';
import { NotificationOutboxWorker } from './notification-outbox.worker';

describe('NotificationOutboxWorker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function createWorker(eventOverrides: Record<string, unknown> = {}) {
    const event = {
      id: '10000000-0000-4000-8000-000000000001',
      type: NotificationOutboxEventType.PAYMENT_VERIFIED,
      aggregateType: 'ORDER',
      aggregateId: '20000000-0000-4000-8000-000000000001',
      deduplicationKey: 'order:test:payment-verified',
      payload: {},
      status: NotificationOutboxStatus.PENDING,
      attempts: 0,
      nextAttemptAt: new Date('2026-08-30T12:00:00.000Z'),
      claimedAt: null,
      processedAt: null,
      lastError: null,
      createdAt: new Date('2026-08-30T12:00:00.000Z'),
      updatedAt: new Date('2026-08-30T12:00:00.000Z'),
      ...eventOverrides,
    };
    const prisma = {
      notificationOutboxEvent: {
        findMany: jest.fn().mockResolvedValue([event]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      order: {
        findUnique: jest.fn().mockResolvedValue({
          orderNumber: 'HS-TEST',
          user: {
            phone: '+989120000000',
          },
          shipment: {
            trackingCode: 'TRACK-1',
          },
        }),
      },
    };
    const smsSender: SmsSender = {
      sendOtp: jest.fn(),
      sendMessage: jest.fn().mockResolvedValue(undefined),
    };
    const config = {
      get: jest.fn(),
    };

    return {
      worker: new NotificationOutboxWorker(
        prisma as unknown as PrismaService,
        smsSender,
        config as unknown as ConfigService,
      ),
      prisma,
      smsSender,
    };
  }

  it('enters dispatching before sending and marks the owned dispatch sent', async () => {
    const { worker, prisma, smsSender } = createWorker();

    await worker.dispatchPending();

    expect(smsSender.sendMessage).toHaveBeenCalledWith({
      phone: '+989120000000',
      text: 'پرداخت سفارش HS-TEST با موفقیت ثبت شد.',
    });
    const claimedAt = prisma.notificationOutboxEvent.updateMany.mock.calls[0]?.[0].data.claimedAt;
    expect(claimedAt).toBeInstanceOf(Date);
    expect(prisma.notificationOutboxEvent.updateMany.mock.calls[1]?.[0]).toEqual({
      where: {
        id: '10000000-0000-4000-8000-000000000001',
        status: NotificationOutboxStatus.PROCESSING,
        claimedAt,
      },
      data: {
        status: NotificationOutboxStatus.DISPATCHING,
      },
    });
    expect(prisma.notificationOutboxEvent.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: {
          id: '10000000-0000-4000-8000-000000000001',
          status: NotificationOutboxStatus.DISPATCHING,
          claimedAt,
        },
        data: expect.objectContaining({
          status: NotificationOutboxStatus.SENT,
          claimedAt: null,
          lastError: null,
        }),
      }),
    );
  });

  it('marks a definitive send failure for retry from dispatching', async () => {
    const { worker, prisma, smsSender } = createWorker();

    (smsSender.sendMessage as jest.Mock).mockRejectedValueOnce(new Error('Kavenegar rejected'));

    await worker.dispatchPending();

    const claimedAt = prisma.notificationOutboxEvent.updateMany.mock.calls[0]?.[0].data.claimedAt;
    expect(prisma.notificationOutboxEvent.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: {
          id: '10000000-0000-4000-8000-000000000001',
          status: NotificationOutboxStatus.DISPATCHING,
          claimedAt,
        },
        data: expect.objectContaining({
          status: NotificationOutboxStatus.FAILED,
          claimedAt: null,
          lastError: 'Kavenegar rejected',
        }),
      }),
    );
  });

  it('quarantines an ambiguous send instead of automatically retrying it', async () => {
    const { worker, prisma, smsSender } = createWorker();

    (smsSender.sendMessage as jest.Mock).mockRejectedValueOnce(
      new SmsDeliveryUnknownError('Kavenegar'),
    );

    await worker.dispatchPending();

    const claimedAt = prisma.notificationOutboxEvent.updateMany.mock.calls[0]?.[0].data.claimedAt;
    expect(prisma.notificationOutboxEvent.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: {
          id: '10000000-0000-4000-8000-000000000001',
          status: NotificationOutboxStatus.DISPATCHING,
          claimedAt,
        },
        data: expect.objectContaining({
          status: NotificationOutboxStatus.UNKNOWN,
          claimedAt: null,
        }),
      }),
    );
  });

  it('quarantines a stale dispatch lease without sending the SMS again', async () => {
    const staleClaim = new Date('2026-08-01T10:00:00.000Z');
    const { worker, prisma, smsSender } = createWorker({
      status: NotificationOutboxStatus.DISPATCHING,
      claimedAt: staleClaim,
      attempts: 1,
    });

    await worker.dispatchPending();

    expect(smsSender.sendMessage).not.toHaveBeenCalled();
    expect(prisma.notificationOutboxEvent.updateMany).toHaveBeenCalledTimes(1);
    expect(prisma.notificationOutboxEvent.updateMany).toHaveBeenCalledWith({
      where: {
        id: '10000000-0000-4000-8000-000000000001',
        status: NotificationOutboxStatus.DISPATCHING,
        claimedAt: staleClaim,
      },
      data: expect.objectContaining({
        status: NotificationOutboxStatus.UNKNOWN,
        claimedAt: null,
      }),
    });
  });
  it('releases a stale processing lease at the automatic retry limit without sending', async () => {
    const staleClaim = new Date('2026-08-01T10:00:00.000Z');
    const { worker, prisma, smsSender } = createWorker({
      status: NotificationOutboxStatus.PROCESSING,
      claimedAt: staleClaim,
      attempts: 8,
    });

    await worker.dispatchPending();

    expect(smsSender.sendMessage).not.toHaveBeenCalled();
    expect(prisma.notificationOutboxEvent.updateMany).toHaveBeenCalledWith({
      where: {
        id: '10000000-0000-4000-8000-000000000001',
        status: NotificationOutboxStatus.PROCESSING,
        claimedAt: staleClaim,
        attempts: {
          gte: 8,
        },
      },
      data: expect.objectContaining({
        status: NotificationOutboxStatus.FAILED,
        claimedAt: null,
      }),
    });
  });
});
