import { BadGatewayException, ServiceUnavailableException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { PaymentInitiationUnknownError } from '../payment-initiation-unknown.error';
import { IranDargahPaymentGateway } from './irandargah-payment.gateway';

describe('IranDargahPaymentGateway', () => {
  const fetchSpy = jest.spyOn(globalThis, 'fetch');

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    fetchSpy.mockRestore();
  });

  function createGateway(sandbox = true, token = `idg_test_${'a'.repeat(32)}`) {
    const config = {
      get: jest.fn((key: string, fallback: unknown) => {
        const values: Record<string, unknown> = {
          IRANDARGAH_API_TOKEN: token,
          IRANDARGAH_SANDBOX: sandbox,
          IRANDARGAH_REQUEST_TIMEOUT_MS: 8_000,
        };
        return values[key] ?? fallback;
      }),
    };

    return new IranDargahPaymentGateway(config as unknown as ConfigService);
  }

  it('creates a sandbox payment with a GET callback and trusted redirect', async () => {
    fetchSpy.mockResolvedValue(
      Response.json({
        success: true,
        data: {
          transaction: {
            authority: '2025100121424146HC',
            gateway_url: 'https://sandbox.irandargah.com/startpay/2025100121424146HC',
          },
        },
      }),
    );
    const gateway = createGateway();

    await expect(
      gateway.initiate({
        attemptId: '10000000-0000-4000-8000-000000000001',
        orderNumber: 'HS-TEST',
        amountRial: '100000',
        callbackUrl:
          'https://hamidian.shop/api/payment/callback/10000000-0000-4000-8000-000000000001',
      }),
    ).resolves.toEqual({
      authority: '2025100121424146HC',
      paymentUrl: 'https://sandbox.irandargah.com/startpay/2025100121424146HC',
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://sandbox.irandargah.com/v2/payments',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: expect.stringMatching(/^Bearer idg_test_/),
          'Idempotency-Key': 'payment-10000000-0000-4000-8000-000000000001',
        }),
        body: JSON.stringify({
          amount: 100_000,
          order_id: 'HS-TEST',
          callback_url:
            'https://hamidian.shop/api/payment/callback/10000000-0000-4000-8000-000000000001',
          description: 'Hamidian Silver order HS-TEST',
          action: 'GET',
          direct_verify: false,
        }),
      }),
    );
  });

  it('verifies the authority and exact Rial amount', async () => {
    fetchSpy.mockResolvedValue(
      Response.json({
        success: true,
        data: {
          verification: {
            ref_id: '123456789',
            authority: '2025100121424146HC',
            amount: 250000,
          },
        },
      }),
    );
    const gateway = createGateway();

    await expect(
      gateway.verify({ authority: '2025100121424146HC', amountRial: '250000' }),
    ).resolves.toEqual({ success: true, referenceId: '123456789' });
  });

  it('maps a verification business rejection to a failed result', async () => {
    fetchSpy.mockResolvedValue(
      Response.json(
        {
          success: false,
          error: { code: -19, message: 'شناسه یا مبلغ اشتباه است' },
        },
        { status: 400 },
      ),
    );
    const gateway = createGateway();

    await expect(
      gateway.verify({ authority: '2025100121424146HC', amountRial: '250000' }),
    ).resolves.toEqual({
      success: false,
      code: '-19',
      message: 'شناسه یا مبلغ اشتباه است',
    });
  });

  it('rejects unsafe amounts and mismatched environment tokens before calling the API', async () => {
    await expect(
      createGateway().initiate({
        attemptId: '10000000-0000-4000-8000-000000000001',
        orderNumber: 'HS-TEST',
        amountRial: '99999',
        callbackUrl: 'https://hamidian.shop/callback',
      }),
    ).rejects.toBeInstanceOf(BadGatewayException);

    await expect(
      createGateway(false).verify({ authority: 'AUTH', amountRial: '100000' }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('marks initiation as unknown when the request transport fails', async () => {
    fetchSpy.mockRejectedValue(new Error('network unavailable'));

    await expect(
      createGateway().initiate({
        attemptId: '10000000-0000-4000-8000-000000000001',
        orderNumber: 'HS-TEST',
        amountRial: '100000',
        callbackUrl: 'https://hamidian.shop/callback',
      }),
    ).rejects.toBeInstanceOf(PaymentInitiationUnknownError);
  });
});
