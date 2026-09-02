import type { ConfigService } from '@nestjs/config';
import { NotificationOutboxStatus, OperationalAlertLevel } from '../../generated/prisma/enums';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { SmsDeliveryUnknownError } from '../auth/sms-delivery-unknown.error';
import type { SmsSender } from '../auth/sms-sender.port';
import { OperationalAlertOutboxWorker } from './operational-alert-outbox.worker';

describe('OperationalAlertOutboxWorker', () => {
  function createWorker(eventOverrides: Record<string, unknown> = {}) {
    const event = {
      id: '10000000-0000-4000-8000-000000000001',
      orderId: '20000000-0000-4000-8000-000000000001',
      recipientUserId: '30000000-0000-4000-8000-000000000001',
      recipientPhone: '+989120000000',
      code: 'SHIPMENT_CREATION_STALE',
      level: OperationalAlertLevel.INITIAL,
      priority: 'HIGH',
      incidentFingerprint: 'fingerprint',
      deduplicationKey: 'dedup',
      dueAt: new Date('2026-08-30T11:00:00.000Z'),
      payload: {
        orderNumber: 'HS-051',
      },
      status: NotificationOutboxStatus.PENDING,
      attempts: 0,
      nextAttemptAt: new Date('2026-08-30T11:00:00.000Z'),
      claimedAt: null,
      processedAt: null,
      lastError: null,
      createdAt: new Date('2026-08-30T11:00:00.000Z'),
      updatedAt: new Date('2026-08-30T11:00:00.000Z'),
      ...eventOverrides,
    };
    const prisma = {
      operationalAlertOutboxEvent: {
        findMany: jest.fn().mockResolvedValue([event]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const smsSender: SmsSender = {
      sendOtp: jest.fn(),
      sendMessage: jest.fn().mockResolvedValue(undefined),
    };
    const config = {
      get: jest.fn(),
    };
    const worker = new OperationalAlertOutboxWorker(
      prisma as unknown as PrismaService,
      smsSender,
      config as unknown as ConfigService,
    );

    return { worker, prisma, smsSender };
  }

  it('sends an internal operational alert only after entering dispatching', async () => {
    const { worker, prisma, smsSender } = createWorker();

    await worker.dispatchPending();

    expect(smsSender.sendMessage).toHaveBeenCalledWith({
      phone: '+989120000000',
      text: 'هشدار عملیات: ایجاد مرسوله سفارش HS-051 بیش از حد مجاز در حال پردازش مانده است.',
    });
    const claimedAt =
      prisma.operationalAlertOutboxEvent.updateMany.mock.calls[0]?.[0].data.claimedAt;
    expect(prisma.operationalAlertOutboxEvent.updateMany.mock.calls[1]?.[0]).toEqual({
      where: {
        id: '10000000-0000-4000-8000-000000000001',
        status: NotificationOutboxStatus.PROCESSING,
        claimedAt,
      },
      data: {
        status: NotificationOutboxStatus.DISPATCHING,
      },
    });
    expect(prisma.operationalAlertOutboxEvent.updateMany).toHaveBeenLastCalledWith(
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

  it('quarantines an ambiguous operational alert delivery', async () => {
    const { worker, prisma, smsSender } = createWorker();
    (smsSender.sendMessage as jest.Mock).mockRejectedValueOnce(
      new SmsDeliveryUnknownError('Kavenegar'),
    );

    await worker.dispatchPending();

    const claimedAt =
      prisma.operationalAlertOutboxEvent.updateMany.mock.calls[0]?.[0].data.claimedAt;
    expect(prisma.operationalAlertOutboxEvent.updateMany).toHaveBeenLastCalledWith(
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
});
