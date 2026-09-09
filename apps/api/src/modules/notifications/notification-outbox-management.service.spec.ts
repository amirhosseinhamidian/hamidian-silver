import { NotificationOutboxStatus } from '../../generated/prisma/enums';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { NotificationOutboxRecoveryService } from './notification-outbox-recovery.service';

describe('Notification outbox management', () => {
  const eventId = '10000000-0000-4000-8000-000000000001';
  const actorUserId = '20000000-0000-4000-8000-000000000001';

  it('does not retry a delivery whose status is no longer failed', async () => {
    const transaction = {
      notificationOutboxEvent: {
        findUnique: jest.fn().mockResolvedValue({
          id: eventId,
          status: NotificationOutboxStatus.SENT,
        }),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const service = new NotificationOutboxRecoveryService(prisma as unknown as PrismaService);

    await expect(
      service.retryFailedCustomer(eventId, actorUserId, { note: 'Manual retry review.' }),
    ).rejects.toThrow('Only failed notification deliveries can be retried.');
  });

  it('combines status counts from both outboxes', async () => {
    const prisma = {
      notificationOutboxEvent: {
        findMany: jest.fn().mockResolvedValue([]),
        groupBy: jest.fn().mockResolvedValue([
          { status: NotificationOutboxStatus.SENT, _count: { _all: 3 } },
          { status: NotificationOutboxStatus.FAILED, _count: { _all: 1 } },
        ]),
      },
      operationalAlertOutboxEvent: {
        findMany: jest.fn().mockResolvedValue([]),
        groupBy: jest.fn().mockResolvedValue([
          { status: NotificationOutboxStatus.SENT, _count: { _all: 2 } },
          { status: NotificationOutboxStatus.UNKNOWN, _count: { _all: 1 } },
        ]),
      },
    };
    const service = new NotificationOutboxRecoveryService(prisma as unknown as PrismaService);

    const snapshot = await service.listOutbox();

    expect(snapshot.summary).toEqual({
      total: 7,
      pending: 0,
      processing: 0,
      dispatching: 0,
      sent: 5,
      failed: 1,
      unknown: 1,
    });
  });
});
