import { Injectable } from '@nestjs/common';

import type { Prisma } from '../../generated/prisma/client';
import { AdminMessageChannel } from '../../generated/prisma/enums';
import { ROLE_CODES } from '../authorization/rbac.constants';

@Injectable()
export class AdminOrderNotificationOutboxService {
  async enqueueOrder(transaction: Prisma.TransactionClient, orderId: string): Promise<void> {
    const recipients = await transaction.adminMessageRecipient.findMany({
      where: {
        OR: [{ telegramChatId: { not: null } }, { baleChatId: { not: null } }],
        user: {
          isActive: true,
          deletedAt: null,
          roles: {
            some: {
              role: {
                code: { in: [ROLE_CODES.MANAGER, ROLE_CODES.ADMIN] },
                isActive: true,
                deletedAt: null,
              },
            },
          },
        },
      },
      select: { userId: true, telegramChatId: true, baleChatId: true },
    });

    const deliveries = recipients.flatMap((recipient) => [
      ...(recipient.telegramChatId
        ? [
            {
              orderId,
              recipientUserId: recipient.userId,
              channel: AdminMessageChannel.TELEGRAM,
              chatIdSnapshot: recipient.telegramChatId,
            },
          ]
        : []),
      ...(recipient.baleChatId
        ? [
            {
              orderId,
              recipientUserId: recipient.userId,
              channel: AdminMessageChannel.BALE,
              chatIdSnapshot: recipient.baleChatId,
            },
          ]
        : []),
    ]);

    if (deliveries.length) {
      await transaction.adminOrderNotificationDelivery.createMany({
        data: deliveries,
        skipDuplicates: true,
      });
    }
  }
}
