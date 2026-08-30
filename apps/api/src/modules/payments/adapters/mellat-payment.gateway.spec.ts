import { BadGatewayException, ServiceUnavailableException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { MellatPaymentGateway } from './mellat-payment.gateway';

describe('MellatPaymentGateway', () => {
  const fetchSpy = jest.spyOn(globalThis, 'fetch');
  const attemptId = '12345678-1234-4234-8234-123456789abc';

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    fetchSpy.mockRestore();
  });

  function createGateway(overrides: Record<string, unknown> = {}) {
    const values: Record<string, unknown> = {
      MELLAT_TERMINAL_ID: '1234567',
      MELLAT_USERNAME: 'merchant-user',
      MELLAT_PASSWORD: 'merchant-password',
      MELLAT_SOAP_URL: 'https://bpm.example.test/services/pgw',
      MELLAT_START_PAY_URL: 'https://bpm.example.test/startpay.mellat',
      MELLAT_REQUEST_TIMEOUT_MS: 10000,
      ...overrides,
    };
    const config = {
      get: jest.fn((key: string, fallback: unknown) => values[key] ?? fallback),
    };

    return new MellatPaymentGateway(config as unknown as ConfigService);
  }

  function soapResponse(value: string) {
    return new Response(
      `<?xml version="1.0"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <ns2:response xmlns:ns2="http://interfaces.core.sw.bps.com/">
      <return>${value}</return>
    </ns2:response>
  </soap:Body>
</soap:Envelope>`,
      {
        status: 200,
        headers: {
          'Content-Type': 'text/xml',
        },
      },
    );
  }

  it('creates a Mellat pay request and returns an internal POST-redirect URL', async () => {
    fetchSpy.mockResolvedValueOnce(soapResponse('0,ABC123Ref'));

    const gateway = createGateway();

    await expect(
      gateway.initiate({
        attemptId,
        orderNumber: 'HS-TEST',
        amountRial: '12000000',
        callbackUrl: `https://api.example.com/api/v1/payments/callback/${attemptId}`,
      }),
    ).resolves.toEqual({
      authority: 'ABC123Ref',
      paymentUrl: `https://api.example.com/api/v1/payments/redirect/${attemptId}/mellat`,
    });

    const body = String(fetchSpy.mock.calls[0][1]?.body);

    expect(body).toContain('<int:bpPayRequest>');
    expect(body).toContain('<amount>12000000</amount>');
    expect(body).toContain(
      `<callBackUrl>https://api.example.com/api/v1/payments/callback/${attemptId}/mellat</callBackUrl>`,
    );
  });

  it('verifies and settles a successful Mellat callback', async () => {
    const gateway = createGateway();

    fetchSpy.mockResolvedValueOnce(soapResponse('0,REF1'));
    const initiated = await gateway.initiate({
      attemptId,
      orderNumber: 'HS-TEST',
      amountRial: '12000000',
      callbackUrl: `https://api.example.com/api/v1/payments/callback/${attemptId}`,
    });
    const requestBody = String(fetchSpy.mock.calls[0][1]?.body);
    const saleOrderId = requestBody.match(/<orderId>(\d+)<\/orderId>/)?.[1];

    expect(saleOrderId).toBeDefined();

    fetchSpy.mockClear();
    fetchSpy.mockResolvedValueOnce(soapResponse('0')).mockResolvedValueOnce(soapResponse('0'));

    await expect(
      gateway.verify({
        authority: initiated.authority,
        amountRial: '12000000',
        callbackData: {
          attemptId,
          resCode: '0',
          saleOrderId,
          saleReferenceId: '987654321',
        },
      } as never),
    ).resolves.toEqual({
      success: true,
      referenceId: '987654321',
    });

    expect(String(fetchSpy.mock.calls[0][1]?.body)).toContain('<int:bpVerifyRequest>');
    expect(String(fetchSpy.mock.calls[1][1]?.body)).toContain('<int:bpSettleRequest>');
  });

  it('accepts already-settled response code 45 as idempotent success', async () => {
    const gateway = createGateway();

    fetchSpy.mockResolvedValueOnce(soapResponse('0,REF3'));
    await gateway.initiate({
      attemptId,
      orderNumber: 'HS-TEST',
      amountRial: '12000000',
      callbackUrl: `https://api.example.com/api/v1/payments/callback/${attemptId}`,
    });
    const requestBody = String(fetchSpy.mock.calls[0][1]?.body);
    const saleOrderId = requestBody.match(/<orderId>(\d+)<\/orderId>/)?.[1];

    fetchSpy.mockClear();
    fetchSpy.mockResolvedValueOnce(soapResponse('45'));

    await expect(
      gateway.verify({
        authority: 'REF3',
        amountRial: '12000000',
        callbackData: {
          attemptId,
          resCode: '0',
          saleOrderId,
          saleReferenceId: '987654321',
        },
      } as never),
    ).resolves.toEqual({
      success: true,
      referenceId: '987654321',
    });
  });

  it('rejects a callback whose SaleOrderId does not belong to the attempt', async () => {
    const gateway = createGateway();

    await expect(
      gateway.verify({
        authority: 'REF4',
        amountRial: '12000000',
        callbackData: {
          attemptId,
          resCode: '0',
          saleOrderId: '999',
          saleReferenceId: '987654321',
        },
      } as never),
    ).resolves.toEqual(
      expect.objectContaining({
        success: false,
        code: 'ORDER_ID_MISMATCH',
      }),
    );

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('requires Mellat credentials only when the adapter is used', async () => {
    const gateway = createGateway({
      MELLAT_TERMINAL_ID: '',
      MELLAT_USERNAME: '',
      MELLAT_PASSWORD: '',
    });

    await expect(
      gateway.initiate({
        attemptId,
        orderNumber: 'HS-TEST',
        amountRial: '12000000',
        callbackUrl: 'https://api.example.com/callback',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects malformed RefId values', () => {
    const gateway = createGateway();

    expect(() => gateway.buildStartPayForm('<script>')).toThrow(BadGatewayException);
  });
});
