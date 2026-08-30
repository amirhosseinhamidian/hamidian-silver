import type { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import type { MellatPaymentGateway } from './adapters/mellat-payment.gateway';
import type { ZarinpalPaymentGateway } from './adapters/zarinpal-payment.gateway';
import type { ZibalPaymentGateway } from './adapters/zibal-payment.gateway';
import { PAYMENT_GATEWAY_CODES } from './payment-gateway.constants';
import { PaymentGatewayRegistry } from './payment-gateway.registry';
import type { PaymentGateway } from './payment-gateway.port';

describe('PaymentGatewayRegistry Mellat integration', () => {
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

  const mellat: jest.Mocked<PaymentGateway> = {
    providerCode: PAYMENT_GATEWAY_CODES.MELLAT,
    initiate: jest.fn(),
    verify: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reports Mellat implemented but unavailable before credentials are configured', async () => {
    config.get.mockImplementation((_key: string, fallback: unknown) => fallback);
    prisma.paymentGatewaySetting.findMany.mockResolvedValue([
      {
        provider: PAYMENT_GATEWAY_CODES.MELLAT,
        isEnabled: true,
        updatedAt: new Date('2026-08-30T12:00:00.000Z'),
      },
    ]);

    const registry = new PaymentGatewayRegistry(
      prisma as unknown as PrismaService,
      config as unknown as ConfigService,
      zarinpal as unknown as ZarinpalPaymentGateway,
      zibal as unknown as ZibalPaymentGateway,
      mellat as unknown as MellatPaymentGateway,
    );

    const settings = await registry.listGatewaySettings();
    const mellatSetting = settings.find(
      ({ provider }) => provider === PAYMENT_GATEWAY_CODES.MELLAT,
    );

    expect(mellatSetting).toEqual(
      expect.objectContaining({
        isEnabled: true,
        isImplemented: true,
        isConfigured: false,
        isAvailable: false,
      }),
    );
  });

  it('routes configured and enabled Mellat initiation to the Mellat adapter', async () => {
    const values: Record<string, string> = {
      MELLAT_TERMINAL_ID: '1234567',
      MELLAT_USERNAME: 'merchant-user',
      MELLAT_PASSWORD: 'merchant-password',
    };
    config.get.mockImplementation((key: string, fallback: unknown) => values[key] ?? fallback);
    prisma.paymentGatewaySetting.findUnique.mockResolvedValue({
      isEnabled: true,
    });
    mellat.initiate.mockResolvedValue({
      authority: 'REF123',
      paymentUrl: 'https://api.example.com/payments/redirect/id/mellat',
    });

    const registry = new PaymentGatewayRegistry(
      prisma as unknown as PrismaService,
      config as unknown as ConfigService,
      zarinpal as unknown as ZarinpalPaymentGateway,
      zibal as unknown as ZibalPaymentGateway,
      mellat as unknown as MellatPaymentGateway,
    );

    await registry.initiate({
      provider: PAYMENT_GATEWAY_CODES.MELLAT,
      attemptId: '12345678-1234-4234-8234-123456789abc',
      orderNumber: 'HS-TEST',
      amountRial: '12000000',
      callbackUrl: 'https://api.example.com/callback',
    });

    expect(mellat.initiate).toHaveBeenCalledTimes(1);
    expect(zarinpal.initiate).not.toHaveBeenCalled();
    expect(zibal.initiate).not.toHaveBeenCalled();
  });
});
