import { timingSafeEqual } from 'node:crypto';

const MAX_REQUEST_BYTES = 16 * 1024;
const MAX_MESSAGE_LENGTH = 4000;
const DEFAULT_TIMEOUT_MS = 8000;
const MIN_TIMEOUT_MS = 1000;
const MAX_TIMEOUT_MS = 9000;

const RESPONSE_HEADERS = {
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
};

function json(payload, status, additionalHeaders = {}) {
  return Response.json(payload, {
    status,
    headers: { ...RESPONSE_HEADERS, ...additionalHeaders },
  });
}

function authorized(request, expectedSecret) {
  const authorization = request.headers.get('authorization') ?? '';
  const expected = `Bearer ${expectedSecret}`;
  const actualBytes = Buffer.from(authorization);
  const expectedBytes = Buffer.from(expected);

  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}

function timeoutMs() {
  const configured = Number(process.env.TELEGRAM_REQUEST_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
  if (!Number.isInteger(configured) || configured < MIN_TIMEOUT_MS || configured > MAX_TIMEOUT_MS) {
    return DEFAULT_TIMEOUT_MS;
  }
  return configured;
}

function telegramDescription(payload, fallback) {
  return typeof payload?.description === 'string' ? payload.description.slice(0, 300) : fallback;
}

async function readTelegramResponse(response) {
  try {
    const payload = await response.json();
    return payload && typeof payload === 'object' ? payload : null;
  } catch {
    return null;
  }
}

function validatePayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return 'Request body must be a JSON object.';
  }

  if (typeof payload.chatId !== 'string' || !/^-?\d{1,20}$/.test(payload.chatId.trim())) {
    return 'chatId must be a numeric Telegram Chat ID.';
  }

  if (
    typeof payload.message !== 'string' ||
    payload.message.length === 0 ||
    payload.message.length > MAX_MESSAGE_LENGTH
  ) {
    return `message must contain between 1 and ${MAX_MESSAGE_LENGTH} characters.`;
  }

  return null;
}

export async function POST(request) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const relaySecret = process.env.TELEGRAM_RELAY_SECRET?.trim();

  if (!botToken || !relaySecret || relaySecret.length < 32) {
    return json({ ok: false, code: 'RELAY_NOT_CONFIGURED' }, 503);
  }

  if (!authorized(request, relaySecret)) {
    return json({ ok: false, code: 'UNAUTHORIZED' }, 401, {
      'WWW-Authenticate': 'Bearer',
    });
  }

  const contentType = request.headers.get('content-type')?.toLowerCase() ?? '';
  if (!contentType.startsWith('application/json')) {
    return json({ ok: false, code: 'UNSUPPORTED_MEDIA_TYPE' }, 415);
  }

  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    return json({ ok: false, code: 'PAYLOAD_TOO_LARGE' }, 413);
  }

  let payload;
  try {
    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody, 'utf8') > MAX_REQUEST_BYTES) {
      return json({ ok: false, code: 'PAYLOAD_TOO_LARGE' }, 413);
    }
    payload = JSON.parse(rawBody);
  } catch {
    return json({ ok: false, code: 'INVALID_JSON' }, 400);
  }

  const validationError = validatePayload(payload);
  if (validationError) {
    return json({ ok: false, code: 'INVALID_REQUEST', description: validationError }, 400);
  }

  let telegramResponse;
  try {
    telegramResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: payload.chatId.trim(),
        text: payload.message,
      }),
      signal: AbortSignal.timeout(timeoutMs()),
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'TimeoutError';
    return json(
      {
        ok: false,
        code: timedOut ? 'TELEGRAM_TIMEOUT' : 'TELEGRAM_UNREACHABLE',
      },
      timedOut ? 504 : 502,
    );
  }

  const telegramPayload = await readTelegramResponse(telegramResponse);
  if (!telegramResponse.ok || telegramPayload?.ok !== true) {
    const retryAfter = Number(telegramPayload?.parameters?.retry_after);
    const hasRetryAfter = Number.isSafeInteger(retryAfter) && retryAfter > 0;

    return json(
      {
        ok: false,
        code: 'TELEGRAM_REJECTED',
        upstreamStatus: telegramResponse.status,
        description: telegramDescription(telegramPayload, `HTTP ${telegramResponse.status}`),
        ...(hasRetryAfter ? { retryAfterSeconds: retryAfter } : {}),
      },
      502,
      hasRetryAfter ? { 'Retry-After': String(retryAfter) } : {},
    );
  }

  const messageId = telegramPayload?.result?.message_id;
  return json(
    {
      ok: true,
      ...(Number.isSafeInteger(messageId) ? { messageId } : {}),
    },
    200,
  );
}
