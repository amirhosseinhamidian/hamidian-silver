import type { ConfigService } from '@nestjs/config';
import { ErrorCode } from '../../common/errors/error-codes';
import { PaymentInitiationRecoveryPolicy } from './payment-initiation-recovery-policy';

describe('PaymentInitiationRecoveryPolicy', () => {
  const attemptId = '10000000-0000-4000-8000-000000000001';

  function createPolicy(values: Record<string, unknown> = {}) {
    const config = {
      get: jest.fn((key: string, defaultValue: unknown) =>
        Object.prototype.hasOwnProperty.call(values, key) ? values[key] : defaultValue,
      ),
    };

    return new PaymentInitiationRecoveryPolicy(config as unknown as ConfigService);
  }

  it('accepts only the canonical Zarinpal redirect for the configured environment', () => {
    const policy = createPolicy({
      ZARINPAL_SANDBOX: true,
    });

    expect(
      policy.requireCanonicalRedirect({
        provider: 'zarinpal',
        attemptId,
        authority: 'A000000000000000000000000000000001',
        paymentUrl: 'https://sandbox.zarinpal.com/pg/StartPay/A000000000000000000000000000000001',
      }),
    ).toBe('https://sandbox.zarinpal.com/pg/StartPay/A000000000000000000000000000000001');

    expect(() =>
      policy.requireCanonicalRedirect({
        provider: 'zarinpal',
        attemptId,
        authority: 'A000000000000000000000000000000001',
        paymentUrl: 'https://example.com/phishing',
      }),
    ).toThrow(
      expect.objectContaining({
        name: 'DomainException',
        code: ErrorCode.PAYMENT_CALLBACK_INVALID,
      }),
    );
  });

  it('enforces the same numeric trackId contract as the Zibal adapter', () => {
    const policy = createPolicy();

    expect(
      policy.requireCanonicalRedirect({
        provider: 'zibal',
        attemptId,
        authority: '123456789',
        paymentUrl: 'https://gateway.zibal.ir/start/123456789',
      }),
    ).toBe('https://gateway.zibal.ir/start/123456789');

    expect(() =>
      policy.requireCanonicalRedirect({
        provider: 'zibal',
        attemptId,
        authority: 'not-a-track-id',
        paymentUrl: 'https://gateway.zibal.ir/start/not-a-track-id',
      }),
    ).toThrow(
      expect.objectContaining({
        name: 'DomainException',
        code: ErrorCode.PAYMENT_CALLBACK_INVALID,
      }),
    );
  });

  it('requires Mellat recovery to use the internal redirect for the exact attempt', () => {
    const policy = createPolicy({
      PAYMENT_CALLBACK_URL: 'https://api.example.com/api/v1/payments/callback',
    });

    expect(
      policy.requireCanonicalRedirect({
        provider: 'mellat',
        attemptId,
        authority: 'REF123ABC',
        paymentUrl: `https://api.example.com/api/v1/payments/redirect/${attemptId}/mellat`,
      }),
    ).toBe(`https://api.example.com/api/v1/payments/redirect/${attemptId}/mellat`);
  });

  it('rejects providers that are not part of the configured gateway set', () => {
    const policy = createPolicy();

    expect(() =>
      policy.requireCanonicalRedirect({
        provider: 'unknown-provider',
        attemptId,
        authority: 'AUTH',
        paymentUrl: 'https://gateway.example/pay/AUTH',
      }),
    ).toThrow(
      expect.objectContaining({
        name: 'DomainException',
        code: ErrorCode.PAYMENT_FAILED,
      }),
    );
  });
});
