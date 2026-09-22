import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { GET } from '../api/health.mjs';
import { POST } from '../api/telegram/send.mjs';

const BOT_TOKEN = '123456789:telegram-test-token';
const RELAY_SECRET = 'relay-test-secret-with-more-than-32-characters';
const originalFetch = globalThis.fetch;
const originalBotToken = process.env.TELEGRAM_BOT_TOKEN;
const originalRelaySecret = process.env.TELEGRAM_RELAY_SECRET;

afterEach(() => {
  globalThis.fetch = originalFetch;
  restoreEnv('TELEGRAM_BOT_TOKEN', originalBotToken);
  restoreEnv('TELEGRAM_RELAY_SECRET', originalRelaySecret);
});

function restoreEnv(name, value) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

function configureRelay() {
  process.env.TELEGRAM_BOT_TOKEN = BOT_TOKEN;
  process.env.TELEGRAM_RELAY_SECRET = RELAY_SECRET;
}

function relayRequest(body, secret = RELAY_SECRET) {
  return new Request('https://relay.example.test/api/telegram/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

test('health endpoint does not expose configuration', async () => {
  const response = GET();

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ok: true,
    service: 'hamidian-telegram-relay',
  });
});

test('rejects a request with an invalid relay secret before calling Telegram', async () => {
  configureRelay();
  globalThis.fetch = async () => {
    throw new Error('Telegram must not be called.');
  };

  const response = await POST(relayRequest({ chatId: '123456789', message: 'test' }, 'wrong'));

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { ok: false, code: 'UNAUTHORIZED' });
});

test('forwards an authenticated message and returns the Telegram message ID', async () => {
  configureRelay();
  let forwardedUrl;
  let forwardedBody;
  globalThis.fetch = async (url, init) => {
    forwardedUrl = String(url);
    forwardedBody = JSON.parse(init.body);
    return Response.json({ ok: true, result: { message_id: 42 } });
  };

  const response = await POST(
    relayRequest({ chatId: '-1001234567890', message: 'سفارش پرداخت شد' }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, messageId: 42 });
  assert.equal(forwardedUrl, `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`);
  assert.deepEqual(forwardedBody, {
    chat_id: '-1001234567890',
    text: 'سفارش پرداخت شد',
  });
});

test('returns a sanitized Telegram rejection and retry delay', async () => {
  configureRelay();
  globalThis.fetch = async () =>
    Response.json(
      {
        ok: false,
        description: 'Too Many Requests',
        parameters: { retry_after: 15 },
      },
      { status: 429 },
    );

  const response = await POST(relayRequest({ chatId: '123456789', message: 'test' }));

  assert.equal(response.status, 502);
  assert.equal(response.headers.get('Retry-After'), '15');
  assert.deepEqual(await response.json(), {
    ok: false,
    code: 'TELEGRAM_REJECTED',
    upstreamStatus: 429,
    description: 'Too Many Requests',
    retryAfterSeconds: 15,
  });
});
