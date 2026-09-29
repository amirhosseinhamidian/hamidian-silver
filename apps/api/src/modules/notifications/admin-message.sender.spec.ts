import { ConfigService } from '@nestjs/config';

import { AdminMessageChannel } from '../../generated/prisma/enums';
import { AdminMessageSender } from './admin-message.sender';

describe('AdminMessageSender', () => {
  afterEach(() => jest.restoreAllMocks());

  it('sends Telegram messages through the secure relay without requiring the bot token', async () => {
    const relaySecret = 'relay-secret-with-at-least-32-characters';
    const config = createConfig({
      TELEGRAM_RELAY_URL: 'https://hamidian-telegram-relay.vercel.app/api/telegram/send',
      TELEGRAM_RELAY_SECRET: relaySecret,
      ADMIN_MESSAGING_REQUEST_TIMEOUT_MS: 15_000,
    });
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true, messageId: 42 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const sender = new AdminMessageSender(config as unknown as ConfigService);

    await sender.send(AdminMessageChannel.TELEGRAM, '123456789', 'سفارش جدید');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://hamidian-telegram-relay.vercel.app/api/telegram/send',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: `Bearer ${relaySecret}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ chatId: '123456789', message: 'سفارش جدید' }),
      }),
    );
    expect(config.get).not.toHaveBeenCalledWith('TELEGRAM_BOT_TOKEN');
  });

  it('uses the official Telegram Bot API directly when no relay is configured', async () => {
    const config = createConfig({
      TELEGRAM_BOT_TOKEN: 'telegram-test-token-123456789',
      ADMIN_MESSAGING_REQUEST_TIMEOUT_MS: 8000,
    });
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockImplementation(
      async () =>
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    );
    const sender = new AdminMessageSender(config as unknown as ConfigService);

    await sender.send(AdminMessageChannel.TELEGRAM, '123456789', 'سفارش جدید');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.telegram.org/bottelegram-test-token-123456789/sendMessage',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ chat_id: '123456789', text: 'سفارش جدید' }),
      }),
    );
  });

  it('sends the product image through the Telegram relay', async () => {
    const relaySecret = 'relay-secret-with-at-least-32-characters';
    const config = createConfig({
      TELEGRAM_RELAY_URL: 'https://hamidian-telegram-relay.vercel.app/api/telegram/send',
      TELEGRAM_RELAY_SECRET: relaySecret,
      ADMIN_MESSAGING_REQUEST_TIMEOUT_MS: 15_000,
    });
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true, messageId: 42 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const sender = new AdminMessageSender(config as unknown as ConfigService);

    await sender.send(
      AdminMessageChannel.TELEGRAM,
      '123456789',
      'سفارش جدید',
      'https://media.hamidian.shop/catalog/ring.webp',
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'https://hamidian-telegram-relay.vercel.app/api/telegram/send',
      expect.objectContaining({
        body: JSON.stringify({
          chatId: '123456789',
          message: 'سفارش جدید',
          imageUrl: 'https://media.hamidian.shop/catalog/ring.webp',
        }),
      }),
    );
  });

  it('uses sendPhoto for Bale when a secure product image is available', async () => {
    const config = createConfig({
      BALE_BOT_TOKEN: 'bale-test-token',
      ADMIN_MESSAGING_REQUEST_TIMEOUT_MS: 8000,
    });
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const sender = new AdminMessageSender(config as unknown as ConfigService);

    await sender.send(
      AdminMessageChannel.BALE,
      '123456789',
      'سفارش جدید',
      'https://media.hamidian.shop/catalog/ring.webp',
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'https://tapi.bale.ai/botbale-test-token/sendPhoto',
      expect.objectContaining({
        body: JSON.stringify({
          chat_id: '123456789',
          photo: 'https://media.hamidian.shop/catalog/ring.webp',
          caption: 'سفارش جدید',
        }),
      }),
    );
  });

  it('preserves long order details by sending the caption remainder as text', async () => {
    const config = createConfig({
      TELEGRAM_BOT_TOKEN: 'telegram-test-token-123456789',
      ADMIN_MESSAGING_REQUEST_TIMEOUT_MS: 8000,
    });
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockImplementation(
      async () =>
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    );
    const sender = new AdminMessageSender(config as unknown as ConfigService);
    const message = `سفارش جدید\n${'جزئیات سفارش '.repeat(100)}`;

    await sender.send(
      AdminMessageChannel.TELEGRAM,
      '123456789',
      message,
      'https://media.hamidian.shop/catalog/ring.webp',
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const firstBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as {
      caption: string;
    };
    const secondBody = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body)) as { text: string };
    expect(firstBody.caption.length).toBeLessThanOrEqual(1024);
    expect(firstBody.caption + secondBody.text).toBe(message);
  });

  it('rejects a partially configured relay before making a request', async () => {
    const config = createConfig({
      TELEGRAM_RELAY_URL: 'https://hamidian-telegram-relay.vercel.app/api/telegram/send',
      ADMIN_MESSAGING_REQUEST_TIMEOUT_MS: 15_000,
    });
    const fetchMock = jest.spyOn(globalThis, 'fetch');
    const sender = new AdminMessageSender(config as unknown as ConfigService);

    await expect(
      sender.send(AdminMessageChannel.TELEGRAM, '123456789', 'سفارش جدید'),
    ).rejects.toThrow('TELEGRAM_RELAY_URL and TELEGRAM_RELAY_SECRET');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('preserves relay network diagnostics without exposing its secret', async () => {
    const relaySecret = 'relay-secret-that-must-never-appear-in-errors';
    const config = createConfig({
      TELEGRAM_RELAY_URL: 'https://hamidian-telegram-relay.vercel.app/api/telegram/send',
      TELEGRAM_RELAY_SECRET: relaySecret,
      ADMIN_MESSAGING_REQUEST_TIMEOUT_MS: 15_000,
    });
    const cause = Object.assign(new Error('connect ENETUNREACH relay:443'), {
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
    expect((error as Error).message).not.toContain(relaySecret);
  });

  it('surfaces a sanitized Telegram rejection returned by the relay', async () => {
    const config = createConfig({
      TELEGRAM_RELAY_URL: 'https://hamidian-telegram-relay.vercel.app/api/telegram/send',
      TELEGRAM_RELAY_SECRET: 'relay-secret-with-at-least-32-characters',
      ADMIN_MESSAGING_REQUEST_TIMEOUT_MS: 15_000,
    });
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: false,
          code: 'TELEGRAM_REJECTED',
          description: 'Forbidden: bot was blocked by the user',
        }),
        { status: 502, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    const sender = new AdminMessageSender(config as unknown as ConfigService);

    await expect(
      sender.send(AdminMessageChannel.TELEGRAM, '123456789', 'سفارش جدید'),
    ).rejects.toThrow('TELEGRAM_REJECTED: Forbidden: bot was blocked by the user');
  });
});

function createConfig(values: Record<string, unknown>) {
  return {
    get: jest.fn((key: string, fallback?: unknown) => values[key] ?? fallback),
  };
}
