import type { ConfigService } from '@nestjs/config';
import {
  NotificationOutboxEventType,
  NotificationOutboxStatus,
} from '../../generated/prisma/enums';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
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
        updateMany: jest
          .fn()
          .mockResolvedValueOnce({ count: 1 })
          .mockResolvedValueOnce({ count: 1 }),
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

  it('claims and sends a pending event, then marks it sent', async () => {
    const { worker, prisma, smsSender } = createWorker();

    await worker.dispatchPending();

    expect(smsSender.sendMessage).toHaveBeenCalledWith({
      phone: '+989120000000',
      text: 'پرداخت سفارش HS-TEST با موفقیت ثبت شد.',
    });
    const claimedAt = prisma.notificationOutboxEvent.updateMany.mock.calls[0]?.[0].data.claimedAt;
    expect(claimedAt).toBeInstanceOf(Date);
    expect(prisma.notificationOutboxEvent.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: {
          id: '10000000-0000-4000-8000-000000000001',
          status: NotificationOutboxStatus.PROCESSING,
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

  it('marks a failed send for retry instead of failing the whole batch', async () => {
    const { worker, prisma, smsSender } = createWorker();

    (smsSender.sendMessage as jest.Mock).mockRejectedValueOnce(new Error('Kavenegar unavailable'));

    await worker.dispatchPending();

    const claimedAt = prisma.notificationOutboxEvent.updateMany.mock.calls[0]?.[0].data.claimedAt;
    expect(claimedAt).toBeInstanceOf(Date);
    expect(prisma.notificationOutboxEvent.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: {
          id: '10000000-0000-4000-8000-000000000001',
          status: NotificationOutboxStatus.PROCESSING,
          claimedAt,
        },
        data: expect.objectContaining({
          status: NotificationOutboxStatus.FAILED,
          claimedAt: null,
          lastError: 'Kavenegar unavailable',
        }),
      }),
    );
  });
});
