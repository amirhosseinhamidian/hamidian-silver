import { createHmac, timingSafeEqual } from 'node:crypto';

const lifetimeMs = 5 * 60_000;
const contextPattern = /^(\d{13})\.([a-f0-9]{64})\.(-|[a-f0-9]{64})\.([a-f0-9]{64})$/;

export function readReferralRiskContext(
  secret: string | undefined,
  header: string | undefined,
  authorization: string | undefined,
  now: Date,
) {
  const token = /^Bearer\s+(\S+)$/i.exec(authorization ?? '')?.[1];
  const match = contextPattern.exec(header ?? '');
  if (!secret || secret.length < 32 || !token || !match) return null;
  const [, timestamp, deviceHash, networkHash, signature] = match;
  const recordedAt = new Date(Number(timestamp));
  if (Math.abs(+now - +recordedAt) > lifetimeMs) return null;
  const expected = createHmac('sha256', secret)
    .update(`referral-context:${timestamp}.${deviceHash}.${networkHash}.${token}`)
    .digest();
  if (!timingSafeEqual(expected, Buffer.from(signature, 'hex'))) return null;
  return { recordedAt, deviceHash, networkHash: networkHash === '-' ? null : networkHash };
}
