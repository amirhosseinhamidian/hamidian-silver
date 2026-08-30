import { NotificationOutboxEventType } from '../../generated/prisma/enums';
import type { Prisma } from '../../generated/prisma/client';
import { NotificationOutboxService } from './notification-outbox.service';

describe('NotificationOutboxService', () => {
  it('enqueues order events with database-level deduplication', async () => {
    const transaction = {
      notificationOutboxEvent: {
        createMany: jest.fn().mockResolvedValue({
          count: 1,
        }),
      },
    };
    const service = new NotificationOutboxService();

    await service.enqueueOrderEvent(transaction as unknown as Prisma.TransactionClient, {
      type: NotificationOutboxEventType.PAYMENT_VERIFIED,
      orderId: '10000000-0000-4000-8000-000000000001',
      deduplicationKey: 'order:10000000-0000-4000-8000-000000000001:payment-verified',
      payload: {
        providerReference: 'REF-1',
      },
    });

    expect(transaction.notificationOutboxEvent.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          type: NotificationOutboxEventType.PAYMENT_VERIFIED,
          aggregateType: 'ORDER',
          aggregateId: '10000000-0000-4000-8000-000000000001',
        }),
      ],
      skipDuplicates: true,
    });
  });
});
