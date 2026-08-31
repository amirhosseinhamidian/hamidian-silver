import {
  NotificationOutboxRecoveryResolution,
  NotificationOutboxStatus,
} from '../../generated/prisma/enums';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { NotificationOutboxRecoveryService } from './notification-outbox-recovery.service';

describe('NotificationOutboxRecoveryService', () => {
  const actorUserId = '10000000-0000-4000-8000-000000000001';
  const eventId = '20000000-0000-4000-8000-000000000001';

  it('lists quarantined customer and operational deliveries together', async () => {
    const prisma = {
      notificationOutboxEvent: {
        findMany: jest.fn().mockResolvedValue([{ id: eventId }]),
      },
      operationalAlertOutboxEvent: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: '30000000-0000-4000-8000-000000000001',
          },
        ]),
      },
    };
    const service = new NotificationOutboxRecoveryService(prisma as unknown as PrismaService);

    await expect(service.listUnknown()).resolves.toEqual({
      customer: [{ id: eventId }],
      operational: [{ id: '30000000-0000-4000-8000-000000000001' }],
      total: 2,
    });
  });

  it('releases an unknown customer delivery for an audited manual retry', async () => {
    const now = new Date('2026-08-31T18:00:00.000Z');
    const transaction = {
      notificationOutboxEvent: {
        findUnique: jest.fn().mockResolvedValue({
          id: eventId,
          status: NotificationOutboxStatus.UNKNOWN,
          lastError: 'Kavenegar delivery outcome is unknown.',
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: eventId,
          status: NotificationOutboxStatus.PENDING,
        }),
      },
      notificationOutboxRecovery: {
        create: jest.fn().mockResolvedValue({}),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const service = new NotificationOutboxRecoveryService(prisma as unknown as PrismaService);

    await service.resolveCustomer(
      eventId,
      actorUserId,
      {
        resolution: NotificationOutboxRecoveryResolution.RETRY_APPROVED,
        note: 'Kavenegar panel confirms that the message was not accepted.',
      },
      now,
    );

    expect(transaction.notificationOutboxEvent.updateMany).toHaveBeenCalledWith({
      where: {
        id: eventId,
        status: NotificationOutboxStatus.UNKNOWN,
      },
      data: {
        status: NotificationOutboxStatus.PENDING,
        nextAttemptAt: now,
        claimedAt: null,
        processedAt: null,
        lastError: null,
      },
    });
    expect(transaction.notificationOutboxRecovery.create).toHaveBeenCalledWith({
      data: {
        eventId,
        resolution: NotificationOutboxRecoveryResolution.RETRY_APPROVED,
        note: 'Kavenegar panel confirms that the message was not accepted.',
        unknownReasonSnapshot: 'Kavenegar delivery outcome is unknown.',
        resolvedByUserId: actorUserId,
      },
    });
  });

  it('marks an unknown operational delivery sent after provider confirmation', async () => {
    const now = new Date('2026-08-31T18:05:00.000Z');
    const transaction = {
      operationalAlertOutboxEvent: {
        findUnique: jest.fn().mockResolvedValue({
          id: eventId,
          status: NotificationOutboxStatus.UNKNOWN,
          lastError: 'Worker lease expired during SMS dispatch.',
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: eventId,
          status: NotificationOutboxStatus.SENT,
        }),
      },
      operationalAlertOutboxRecovery: {
        create: jest.fn().mockResolvedValue({}),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const service = new NotificationOutboxRecoveryService(prisma as unknown as PrismaService);

    await service.resolveOperational(
      eventId,
      actorUserId,
      {
        resolution: NotificationOutboxRecoveryResolution.MARKED_SENT,
        note: 'Kavenegar panel confirms successful delivery.',
      },
      now,
    );

    expect(transaction.operationalAlertOutboxEvent.updateMany).toHaveBeenCalledWith({
      where: {
        id: eventId,
        status: NotificationOutboxStatus.UNKNOWN,
      },
      data: {
        status: NotificationOutboxStatus.SENT,
        claimedAt: null,
        processedAt: now,
        lastError: null,
      },
    });
    expect(transaction.operationalAlertOutboxRecovery.create).toHaveBeenCalledWith({
      data: {
        eventId,
        resolution: NotificationOutboxRecoveryResolution.MARKED_SENT,
        note: 'Kavenegar panel confirms successful delivery.',
        unknownReasonSnapshot: 'Worker lease expired during SMS dispatch.',
        resolvedByUserId: actorUserId,
      },
    });
  });

  it('rejects recovery after another worker changes the unknown state', async () => {
    const transaction = {
      notificationOutboxEvent: {
        findUnique: jest.fn().mockResolvedValue({
          id: eventId,
          status: NotificationOutboxStatus.UNKNOWN,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findUniqueOrThrow: jest.fn(),
      },
      notificationOutboxRecovery: {
        create: jest.fn(),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const service = new NotificationOutboxRecoveryService(prisma as unknown as PrismaService);

    await expect(
      service.resolveCustomer(eventId, actorUserId, {
        resolution: NotificationOutboxRecoveryResolution.MARKED_SENT,
        note: 'Provider review completed.',
      }),
    ).rejects.toThrow('Notification recovery state changed; reload before resolving again.');

    expect(transaction.notificationOutboxRecovery.create).not.toHaveBeenCalled();
  });
});
