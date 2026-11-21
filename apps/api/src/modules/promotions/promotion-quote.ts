import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

const quoteLifetimeMs = 5 * 60_000;
const uuid = '[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}';
const tokenFormat = new RegExp(`^(${uuid})\\.(\\d{13})\\.(-|${uuid})\\.([a-f0-9]{64})$`);

export function parseQuoteToken(token: string) {
  const match = tokenFormat.exec(token);
  return match
    ? {
        orderId: match[1],
        expiresAt: Number(match[2]),
        campaignId: match[3] === '-' ? null : match[3],
        signature: match[4],
      }
    : null;
}

function signature(secret: string, coordinates: string, binding: unknown) {
  return createHmac('sha256', secret)
    .update('hamidian:checkout-quote:v1:')
    .update(coordinates)
    .update(JSON.stringify(binding))
    .digest('hex');
}

export function createQuoteToken(
  secret: string,
  campaignId: string | null,
  binding: unknown,
  now: Date,
) {
  const expiresAt = now.getTime() + quoteLifetimeMs;
  const coordinates = `${randomUUID()}.${expiresAt}.${campaignId ?? '-'}`;
  return {
    quoteToken: `${coordinates}.${signature(secret, coordinates, binding)}`,
    expiresAt: new Date(expiresAt).toISOString(),
  };
}

export function matchesQuote(
  secret: string,
  quote: NonNullable<ReturnType<typeof parseQuoteToken>>,
  binding: unknown,
  now: Date,
) {
  if (quote.expiresAt <= now.getTime()) return false;
  const coordinates = `${quote.orderId}.${quote.expiresAt}.${quote.campaignId ?? '-'}`;
  return timingSafeEqual(
    Buffer.from(quote.signature, 'hex'),
    Buffer.from(signature(secret, coordinates, binding), 'hex'),
  );
}

export function quoteTokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex');
}
