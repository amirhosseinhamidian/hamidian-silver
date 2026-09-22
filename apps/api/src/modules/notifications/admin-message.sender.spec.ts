import { ConfigService } from '@nestjs/config';

import { AdminMessageChannel } from '../../generated/prisma/enums';
import { AdminMessageSender } from './admin-message.sender';

describe('AdminMessageSender', () => {
  afterEach(() => jest.restoreAllMocks());

  it('uses the configured Telegram Bot API base URL', async () => {
    const config = {
      get: jest.fn((key: string, fallback?: unknown) => {
        const values: Record<string, unknown> = {
          TELEGRAM_BOT_TOKEN: 'telegram-test-token-123456789',
          TELEGRAM_BOT_API_BASE_URL: 'https://telegram-relay.example.com/bot-api/',
          ADMIN_MESSAGING_REQUEST_TIMEOUT_MS: 8000,
        };
        return values[key] ?? fallback;
      }),
    };
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const sender = new AdminMessageSender(config as unknown as ConfigService);

    await sender.send(AdminMessageChannel.TELEGRAM, '123456789', 'سفارش جدید');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://telegram-relay.example.com/bot-api/bottelegram-test-token-123456789/sendMessage',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ chat_id: '123456789', text: 'سفارش جدید' }),
      }),
    );
  });

  it('preserves the network error code without exposing the bot token', async () => {
    const token = 'telegram-secret-token-123456789';
    const config = {
      get: jest.fn((key: string, fallback?: unknown) => {
        const values: Record<string, unknown> = {
          TELEGRAM_BOT_TOKEN: token,
          ADMIN_MESSAGING_REQUEST_TIMEOUT_MS: 8000,
        };
        return values[key] ?? fallback;
      }),
    };
    const cause = Object.assign(new Error('connect ENETUNREACH 10.10.34.36:443'), {
      code: 'ENETUNREACH',
    });
    jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(Object.assign(new TypeError('fetch failed'), { cause }));
    const sender = new AdminMessageSender(config as unknown as ConfigService);

    const error = await sender
      .send(AdminMessageChannel.TELEGRAM, '123456789', 'سفارش جدید')
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain('ENETUNREACH');
    expect((error as Error).message).toContain('TELEGRAM_BOT_API_BASE_URL');
    expect((error as Error).message).not.toContain(token);
  });
});
