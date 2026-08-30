import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { NotificationOutboxEventType } from '../../generated/prisma/enums';

type EnqueueOrderEventInput = {
  type: NotificationOutboxEventType;
  orderId: string;
  deduplicationKey: string;
  payload?: Prisma.InputJsonValue;
};

@Injectable()
export class NotificationOutboxService {
  enqueueOrderEvent(transaction: Prisma.TransactionClient, input: EnqueueOrderEventInput) {
    return transaction.notificationOutboxEvent.createMany({
      data: [
        {
          type: input.type,
          aggregateType: 'ORDER',
          aggregateId: input.orderId,
          deduplicationKey: input.deduplicationKey,
          payload: input.payload ?? {},
        },
      ],
      skipDuplicates: true,
    });
  }
}
