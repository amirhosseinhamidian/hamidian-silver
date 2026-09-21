import { describe, expect, it } from 'vitest';

import { parseOrderNotificationRecipientsSnapshot } from './order-notification-recipients-model';

describe('parseOrderNotificationRecipientsSnapshot', () => {
  it('accepts manager and admin recipient settings', () => {
    const snapshot = {
      telegramConfigured: true,
      baleConfigured: false,
      recipients: [
        {
          userId: 'admin-1',
          phone: '09121234567',
          firstName: 'مدیر',
          lastName: null,
          roles: ['MANAGER'],
          telegramChatId: '123456789',
          baleChatId: null,
        },
      ],
    };

    expect(parseOrderNotificationRecipientsSnapshot(snapshot)).toEqual(snapshot);
  });

  it('rejects non-administrative roles and malformed channel state', () => {
    expect(
      parseOrderNotificationRecipientsSnapshot({
        telegramConfigured: 'yes',
        baleConfigured: false,
        recipients: [],
      }),
    ).toBeNull();
    expect(
      parseOrderNotificationRecipientsSnapshot({
        telegramConfigured: true,
        baleConfigured: true,
        recipients: [
          {
            userId: 'user-1',
            phone: '09121234567',
            firstName: null,
            lastName: null,
            roles: ['USER'],
            telegramChatId: null,
            baleChatId: null,
          },
        ],
      }),
    ).toBeNull();
  });
});
