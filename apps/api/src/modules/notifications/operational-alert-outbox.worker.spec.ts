import type { ConfigService } from '@nestjs/config';
import { NotificationOutboxStatus, OperationalAlertLevel } from '../../generated/prisma/enums';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import type { SmsSender } from '../auth/sms-sender.port';
import { OperationalAlertOutboxWorker } from './operational-alert-outbox.worker';

describe('OperationalAlertOutboxWorker', () => {
  it('sends an internal operational alert to the snapshotted staff phone', async () => {
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
    };
    const prisma = {
      operationalAlertOutboxEvent: {
        findMany: jest.fn().mockResolvedValue([event]),
        updateMany: jest
          .fn()
          .mockResolvedValueOnce({ count: 1 })
          .mockResolvedValueOnce({ count: 1 }),
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

    await worker.dispatchPending();

    expect(smsSender.sendMessage).toHaveBeenCalledWith({
      phone: '+989120000000',
      text: 'هشدار عملیات: ایجاد مرسوله سفارش HS-051 بیش از حد مجاز در حال پردازش مانده است.',
    });
    expect(prisma.operationalAlertOutboxEvent.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: NotificationOutboxStatus.SENT,
          claimedAt: null,
          lastError: null,
        }),
      }),
    );
  });
});
