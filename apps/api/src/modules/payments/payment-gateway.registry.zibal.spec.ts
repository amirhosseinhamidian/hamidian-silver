import type { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import type { ZarinpalPaymentGateway } from './adapters/zarinpal-payment.gateway';
import type { ZibalPaymentGateway } from './adapters/zibal-payment.gateway';
import { PAYMENT_GATEWAY_CODES } from './payment-gateway.constants';
import { PaymentGatewayRegistry } from './payment-gateway.registry';
import type { PaymentGateway } from './payment-gateway.port';

describe('PaymentGatewayRegistry Zibal integration', () => {
  const prisma = {
    paymentGatewaySetting: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  const config = {
    get: jest.fn(),
  };

  const zarinpal: jest.Mocked<PaymentGateway> = {
    providerCode: PAYMENT_GATEWAY_CODES.ZARINPAL,
    initiate: jest.fn(),
    verify: jest.fn(),
  };

  const zibal: jest.Mocked<PaymentGateway> = {
    providerCode: PAYMENT_GATEWAY_CODES.ZIBAL,
    initiate: jest.fn(),
    verify: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reports Zibal implemented but unavailable until merchant credentials exist', async () => {
    config.get.mockImplementation((key: string, fallback: unknown) =>
      key === 'ZIBAL_MERCHANT_ID' ? '' : fallback,
    );
    prisma.paymentGatewaySetting.findMany.mockResolvedValue([
      {
        provider: PAYMENT_GATEWAY_CODES.ZIBAL,
        isEnabled: true,
        updatedAt: new Date('2026-08-30T12:00:00.000Z'),
      },
    ]);

    const registry = new PaymentGatewayRegistry(
      prisma as unknown as PrismaService,
      config as unknown as ConfigService,
      zarinpal as unknown as ZarinpalPaymentGateway,
      zibal as unknown as ZibalPaymentGateway,
    );

    const settings = await registry.listGatewaySettings();
    const zibalSetting = settings.find(({ provider }) => provider === PAYMENT_GATEWAY_CODES.ZIBAL);

    expect(zibalSetting).toEqual(
      expect.objectContaining({
        isEnabled: true,
        isImplemented: true,
        isConfigured: false,
        isAvailable: false,
      }),
    );
  });

  it('routes enabled and configured Zibal initiations to the Zibal adapter', async () => {
    config.get.mockImplementation((key: string, fallback: unknown) =>
      key === 'ZIBAL_MERCHANT_ID' ? 'zibal-test-merchant' : fallback,
    );
    prisma.paymentGatewaySetting.findUnique.mockResolvedValue({
      isEnabled: true,
    });
    zibal.initiate.mockResolvedValue({
      authority: '1533727744287',
      paymentUrl: 'https://gateway.zibal.ir/start/1533727744287',
    });

    const registry = new PaymentGatewayRegistry(
      prisma as unknown as PrismaService,
      config as unknown as ConfigService,
      zarinpal as unknown as ZarinpalPaymentGateway,
      zibal as unknown as ZibalPaymentGateway,
    );

    await registry.initiate({
      provider: PAYMENT_GATEWAY_CODES.ZIBAL,
      attemptId: '10000000-0000-4000-8000-000000000001',
      orderNumber: 'HS-TEST',
      amountRial: '12000000',
      callbackUrl: 'https://api.example.com/callback',
    });

    expect(zibal.initiate).toHaveBeenCalledTimes(1);
    expect(zarinpal.initiate).not.toHaveBeenCalled();
  });
});
