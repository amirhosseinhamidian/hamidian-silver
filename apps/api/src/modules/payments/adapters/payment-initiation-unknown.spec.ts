import type { ConfigService } from '@nestjs/config';
import { PaymentInitiationUnknownError } from '../payment-initiation-unknown.error';
import { MellatPaymentGateway } from './mellat-payment.gateway';
import { ZarinpalPaymentGateway } from './zarinpal-payment.gateway';
import { ZibalPaymentGateway } from './zibal-payment.gateway';

describe('payment gateway initiation unknown outcome', () => {
  const fetchSpy = jest.spyOn(globalThis, 'fetch');

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    fetchSpy.mockRestore();
  });

  function config(values: Record<string, unknown>) {
    return {
      get: jest.fn((key: string, defaultValue: unknown) =>
        Object.prototype.hasOwnProperty.call(values, key) ? values[key] : defaultValue,
      ),
    } as unknown as ConfigService;
  }

  const input = {
    attemptId: '10000000-0000-4000-8000-000000000001',
    orderNumber: 'HS-UNKNOWN',
    amountRial: '10000000',
    callbackUrl:
      'https://api.example.com/api/v1/payments/callback/10000000-0000-4000-8000-000000000001',
  };

  it('classifies Zarinpal transport failure as an unknown initiation outcome', async () => {
    fetchSpy.mockRejectedValue(new Error('network timeout'));
    const gateway = new ZarinpalPaymentGateway(
      config({
        ZARINPAL_MERCHANT_ID: '00000000-0000-4000-8000-000000000001',
        ZARINPAL_SANDBOX: true,
      }),
    );

    await expect(gateway.initiate(input)).rejects.toBeInstanceOf(PaymentInitiationUnknownError);
  });

  it('classifies Zibal transport failure as an unknown initiation outcome', async () => {
    fetchSpy.mockRejectedValue(new Error('network timeout'));
    const gateway = new ZibalPaymentGateway(
      config({
        ZIBAL_MERCHANT_ID: 'zibal-merchant',
      }),
    );

    await expect(gateway.initiate(input)).rejects.toBeInstanceOf(PaymentInitiationUnknownError);
  });

  it('classifies Mellat transport failure as an unknown initiation outcome', async () => {
    fetchSpy.mockRejectedValue(new Error('network timeout'));
    const gateway = new MellatPaymentGateway(
      config({
        MELLAT_TERMINAL_ID: '123456',
        MELLAT_USERNAME: 'merchant-user',
        MELLAT_PASSWORD: 'merchant-password',
      }),
    );

    await expect(gateway.initiate(input)).rejects.toBeInstanceOf(PaymentInitiationUnknownError);
  });
});
