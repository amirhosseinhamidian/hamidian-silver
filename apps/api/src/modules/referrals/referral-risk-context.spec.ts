import { createHmac } from 'node:crypto';
import { readReferralRiskContext } from './referral-risk-context';

it('only trusts a recent risk context bound to the authenticated session', () => {
  const now = new Date('2026-11-24T09:00:00Z');
  const secret = 'local-test-secret-for-referral-risk-123';
  const deviceHash = 'a'.repeat(64);
  const networkHash = 'b'.repeat(64);
  const body = `${+now}.${deviceHash}.${networkHash}`;
  const token = 'sample-session';
  const signature = createHmac('sha256', secret)
    .update(`referral-context:${body}.${token}`)
    .digest('hex');
  const header = `${body}.${signature}`;

  expect(readReferralRiskContext(secret, header, `Bearer ${token}`, now)).toEqual({
    recordedAt: now,
    deviceHash,
    networkHash,
  });
  expect(readReferralRiskContext(secret, header, 'Bearer other-session', now)).toBeNull();
  expect(
    readReferralRiskContext(
      secret,
      header.replace(networkHash, 'c'.repeat(64)),
      `Bearer ${token}`,
      now,
    ),
  ).toBeNull();
  expect(
    readReferralRiskContext(secret, header, `Bearer ${token}`, new Date(+now + 301_000)),
  ).toBeNull();
});
