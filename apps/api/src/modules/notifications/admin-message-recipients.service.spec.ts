import { ConfigService } from '@nestjs/config';

import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { ROLE_CODES } from '../authorization/rbac.constants';
import { AdminMessageRecipientsService } from './admin-message-recipients.service';

describe('AdminMessageRecipientsService', () => {
  it('reports Telegram as configured when the secure relay pair is present', async () => {
    const prisma = {
      user: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const values: Record<string, string> = {
      TELEGRAM_RELAY_URL: 'https://hamidian-telegram-relay.vercel.app/api/telegram/send',
      TELEGRAM_RELAY_SECRET: 'relay-secret-with-at-least-32-characters',
    };
    const config = {
      get: jest.fn((key: string) => values[key]),
    };
    const service = new AdminMessageRecipientsService(
      prisma as unknown as PrismaService,
      config as unknown as ConfigService,
    );

    await expect(service.list([ROLE_CODES.MANAGER])).resolves.toEqual({
      telegramConfigured: true,
      baleConfigured: false,
      recipients: [],
    });
  });
});
