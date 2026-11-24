import { assessReferralRisk, defaultReferralRiskPolicy } from './referral-risk-engine';

const now = new Date('2026-11-24T09:00:00Z');

it('does not hold or reject on an isolated shared network or address', () => {
  const policy = defaultReferralRiskPolicy();
  policy.minSignals = 1;
  policy.signals.forEach((signal) => {
    signal.weight = 100;
  });
  expect(assessReferralRisk(policy, { SHARED_NETWORK: 1 }, 'sample', now).action).toBe('ALLOW');
  expect(assessReferralRisk(policy, { SHARED_ADDRESS: 100 }, 'sample', now).action).toBe('ALLOW');
  expect(
    assessReferralRisk(policy, { SHARED_ADDRESS: 100, SHARED_NETWORK: 1 }, 'sample', now).action,
  ).toBe('REVIEW');
});

it('requires strong evidence for rejection and honors independent thresholds and exceptions', () => {
  const policy = defaultReferralRiskPolicy();
  policy.signals.forEach((signal) => {
    signal.weight = 100;
  });
  expect(
    assessReferralRisk(policy, { SHARED_DEVICE: 1, CANCELLED_ORDERS: 4 }, 'sample', now).action,
  ).toBe('HOLD');
  expect(
    assessReferralRisk(policy, { VERIFIED_PAYMENT_REUSE: 1, SHARED_DEVICE: 1 }, 'sample', now)
      .action,
  ).toBe('REJECT');
  policy.exceptions.push({
    attributionId: 'sample',
    codes: ['VERIFIED_PAYMENT_REUSE'],
    reason: 'Verified customer case',
    until: '2026-12-01T00:00:00Z',
  });
  expect(
    assessReferralRisk(policy, { VERIFIED_PAYMENT_REUSE: 1, SHARED_DEVICE: 1 }, 'sample', now)
      .action,
  ).toBe('ALLOW');
  expect(
    assessReferralRisk(
      policy,
      { VERIFIED_PAYMENT_REUSE: 1, SHARED_DEVICE: 1 },
      'sample',
      new Date('2026-12-01T00:00:00Z'),
    ).action,
  ).toBe('REJECT');
});
