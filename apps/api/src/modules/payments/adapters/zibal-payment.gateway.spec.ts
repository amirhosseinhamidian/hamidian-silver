import { BadGatewayException, ServiceUnavailableException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { ZibalPaymentGateway } from './zibal-payment.gateway';

describe('ZibalPaymentGateway', () => {
  const fetchSpy = jest.spyOn(globalThis, 'fetch');

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    fetchSpy.mockRestore();
  });

  function createGateway(merchantId = 'zibal-test-merchant') {
    const config = {
      get: jest.fn((key: string, fallback: unknown) =>
        key === 'ZIBAL_MERCHANT_ID' ? merchantId : fallback,
      ),
    };

    return new ZibalPaymentGateway(config as unknown as ConfigService);
  }

  it('requests a transaction in Rial and returns the Zibal payment URL', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          result: 100,
          message: 'success',
          trackId: 1533727744287,
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      ),
    );

    const gateway = createGateway();

    await expect(
      gateway.initiate({
        attemptId: '10000000-0000-4000-8000-000000000001',
        orderNumber: 'HS-TEST',
        amountRial: '12000000',
        callbackUrl:
          'https://api.example.com/api/v1/payments/callback/10000000-0000-4000-8000-000000000001',
      }),
    ).resolves.toEqual({
      authority: '1533727744287',
      paymentUrl: 'https://gateway.zibal.ir/start/1533727744287',
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://gateway.zibal.ir/v1/request',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          merchant: 'zibal-test-merchant',
          amount: 12000000,
          callbackUrl:
            'https://api.example.com/api/v1/payments/callback/10000000-0000-4000-8000-000000000001/zibal',
          description: 'Hamidian Silver order HS-TEST',
        }),
      }),
    );
  });

  it('verifies a transaction and returns refNumber', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          result: 100,
          status: 1,
          amount: 12000000,
          refNumber: 987654321,
          message: 'success',
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      ),
    );

    const gateway = createGateway();

    await expect(
      gateway.verify({
        authority: '1533727744287',
        amountRial: '12000000',
      }),
    ).resolves.toEqual({
      success: true,
      referenceId: '987654321',
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://gateway.zibal.ir/v1/verify',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          merchant: 'zibal-test-merchant',
          trackId: 1533727744287,
        }),
      }),
    );
  });

  it('accepts an already-verified result for idempotent recovery', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          result: 201,
          status: 1,
          amount: 12000000,
          message: 'already verified',
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      ),
    );

    const gateway = createGateway();

    await expect(
      gateway.verify({
        authority: '1533727744287',
        amountRial: '12000000',
      }),
    ).resolves.toEqual({
      success: true,
      referenceId: '1533727744287',
    });
  });

  it('rejects a verified response when the amount does not match', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          result: 100,
          status: 1,
          amount: 13000000,
          refNumber: 987654321,
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      ),
    );

    const gateway = createGateway();

    await expect(
      gateway.verify({
        authority: '1533727744287',
        amountRial: '12000000',
      }),
    ).resolves.toEqual({
      success: false,
      code: 'AMOUNT_MISMATCH',
      message: 'Zibal verified a different payment amount.',
    });
  });

  it('requires merchant credentials only when the adapter is used', async () => {
    const gateway = createGateway('');

    await expect(
      gateway.initiate({
        attemptId: '10000000-0000-4000-8000-000000000001',
        orderNumber: 'HS-TEST',
        amountRial: '12000000',
        callbackUrl: 'https://api.example.com/callback',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('maps provider transport failures to service unavailable', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('network unavailable'));

    const gateway = createGateway();

    await expect(
      gateway.verify({
        authority: '1533727744287',
        amountRial: '12000000',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('rejects invalid track identifiers before calling Zibal', async () => {
    const gateway = createGateway();

    await expect(
      gateway.verify({
        authority: 'invalid',
        amountRial: '12000000',
      }),
    ).rejects.toBeInstanceOf(BadGatewayException);

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
