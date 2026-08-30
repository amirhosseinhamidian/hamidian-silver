import { BadGatewayException, ServiceUnavailableException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { ZarinpalPaymentGateway } from './zarinpal-payment.gateway';

describe('ZarinpalPaymentGateway', () => {
  const fetchSpy = jest.spyOn(globalThis, 'fetch');

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    fetchSpy.mockRestore();
  });

  function createGateway(sandbox = true) {
    const config = {
      get: jest.fn((key: string, defaultValue: unknown) => {
        if (key === 'ZARINPAL_MERCHANT_ID') {
          return '00000000-0000-4000-8000-000000000001';
        }

        return key === 'ZARINPAL_SANDBOX' ? sandbox : defaultValue;
      }),
    };

    return new ZarinpalPaymentGateway(config as unknown as ConfigService);
  }

  it('creates a sandbox payment request and StartPay URL', async () => {
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            code: 100,
            authority: 'A000000000000000000000000000000000001',
          },
          errors: [],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const gateway = createGateway(true);

    await expect(
      gateway.initiate({
        attemptId: '10000000-0000-4000-8000-000000000001',
        orderNumber: 'HS-TEST',
        amountRial: '31250000',
        callbackUrl:
          'https://api.example.com/api/v1/payments/callback/10000000-0000-4000-8000-000000000001',
      }),
    ).resolves.toEqual({
      authority: 'A000000000000000000000000000000000001',
      paymentUrl: 'https://sandbox.zarinpal.com/pg/StartPay/A000000000000000000000000000000000001',
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://sandbox.zarinpal.com/pg/v4/payment/request.json',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          merchant_id: '00000000-0000-4000-8000-000000000001',
          amount: 31_250_000,
          callback_url:
            'https://api.example.com/api/v1/payments/callback/10000000-0000-4000-8000-000000000001',
          description: 'Hamidian Silver order HS-TEST',
        }),
      }),
    );
  });

  it('uses the production v4 endpoint when sandbox is disabled', async () => {
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            code: 100,
            authority: 'A000000000000000000000000000000000002',
          },
          errors: [],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const gateway = createGateway(false);

    const result = await gateway.initiate({
      attemptId: '10000000-0000-4000-8000-000000000001',
      orderNumber: 'HS-PROD',
      amountRial: '1000000',
      callbackUrl: 'https://api.example.com/api/v1/payments/callback/test',
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.zarinpal.com/pg/v4/payment/request.json',
      expect.any(Object),
    );
    expect(result.paymentUrl).toBe(
      'https://www.zarinpal.com/pg/StartPay/A000000000000000000000000000000000002',
    );
  });

  it('accepts successful verification codes 100 and 101', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: { code: 100, ref_id: 123456789 },
          errors: [],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: { code: 101, ref_id: 987654321 },
          errors: [],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const gateway = createGateway();

    await expect(
      gateway.verify({
        authority: 'AUTH-1',
        amountRial: '10000000',
      }),
    ).resolves.toEqual({
      success: true,
      referenceId: '123456789',
    });

    await expect(
      gateway.verify({
        authority: 'AUTH-1',
        amountRial: '10000000',
      }),
    ).resolves.toEqual({
      success: true,
      referenceId: '987654321',
    });
  });

  it('maps a verification rejection to a domain failure result', async () => {
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: { code: -51 },
          errors: {
            code: -51,
            message: 'Payment not successful',
            validations: [],
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const gateway = createGateway();

    await expect(
      gateway.verify({
        authority: 'AUTH-1',
        amountRial: '10000000',
      }),
    ).resolves.toEqual({
      success: false,
      code: '-51',
      message: 'Payment not successful',
    });
  });

  it('fails safely when the Zarinpal API is unavailable', async () => {
    fetchSpy.mockRejectedValue(new Error('network unavailable'));

    const gateway = createGateway();

    await expect(
      gateway.initiate({
        attemptId: '10000000-0000-4000-8000-000000000001',
        orderNumber: 'HS-TEST',
        amountRial: '10000000',
        callbackUrl: 'https://api.example.com/callback',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('rejects unsafe Rial amounts before contacting Zarinpal', async () => {
    const gateway = createGateway();

    await expect(
      gateway.initiate({
        attemptId: '10000000-0000-4000-8000-000000000001',
        orderNumber: 'HS-TEST',
        amountRial: '90071992547409920',
        callbackUrl: 'https://api.example.com/callback',
      }),
    ).rejects.toBeInstanceOf(BadGatewayException);

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
