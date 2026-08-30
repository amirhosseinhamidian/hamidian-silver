import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import type { ZarinpalPaymentGateway } from './adapters/zarinpal-payment.gateway';
import { PAYMENT_GATEWAY_CODES } from './payment-gateway.constants';
import { PaymentGatewayRegistry } from './payment-gateway.registry';
import type { PaymentGateway } from './payment-gateway.port';

describe('PaymentGatewayRegistry', () => {
  const actorUserId = '10000000-0000-4000-8000-000000000001';

  const prisma = {
    paymentGatewaySetting: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
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

  let registry: PaymentGatewayRegistry;

  beforeEach(() => {
    jest.clearAllMocks();
    config.get.mockImplementation((key: string, fallback: unknown) =>
      key === 'ZARINPAL_MERCHANT_ID' ? '' : fallback,
    );
    registry = new PaymentGatewayRegistry(
      prisma as unknown as PrismaService,
      config as unknown as ConfigService,
      zarinpal as unknown as ZarinpalPaymentGateway,
    );
  });

  it('shows enabled and configured as separate manager-visible states', async () => {
    prisma.paymentGatewaySetting.findMany.mockResolvedValue([
      {
        provider: PAYMENT_GATEWAY_CODES.ZARINPAL,
        isEnabled: true,
        updatedAt: new Date('2026-08-30T12:00:00.000Z'),
      },
    ]);

    const settings = await registry.listGatewaySettings();
    const zarinpalSetting = settings.find(
      ({ provider }) => provider === PAYMENT_GATEWAY_CODES.ZARINPAL,
    );
    const zibalSetting = settings.find(({ provider }) => provider === PAYMENT_GATEWAY_CODES.ZIBAL);

    expect(zarinpalSetting).toEqual(
      expect.objectContaining({
        isEnabled: true,
        isImplemented: true,
        isConfigured: false,
        isAvailable: false,
      }),
    );
    expect(zibalSetting).toEqual(
      expect.objectContaining({
        isEnabled: false,
        isImplemented: false,
        isConfigured: false,
        isAvailable: false,
      }),
    );
  });

  it('lets Manager enable a gateway even before credentials are configured', async () => {
    prisma.paymentGatewaySetting.upsert.mockResolvedValue({
      provider: PAYMENT_GATEWAY_CODES.ZIBAL,
      isEnabled: true,
      updatedAt: new Date('2026-08-30T12:00:00.000Z'),
    });

    await expect(
      registry.updateGatewaySetting(PAYMENT_GATEWAY_CODES.ZIBAL, true, actorUserId),
    ).resolves.toEqual(
      expect.objectContaining({
        provider: PAYMENT_GATEWAY_CODES.ZIBAL,
        isEnabled: true,
        isImplemented: false,
        isConfigured: false,
        isAvailable: false,
      }),
    );

    expect(prisma.paymentGatewaySetting.upsert).toHaveBeenCalledWith({
      where: {
        provider: PAYMENT_GATEWAY_CODES.ZIBAL,
      },
      update: {
        isEnabled: true,
        updatedByUserId: actorUserId,
      },
      create: {
        provider: PAYMENT_GATEWAY_CODES.ZIBAL,
        isEnabled: true,
        updatedByUserId: actorUserId,
      },
      select: {
        provider: true,
        isEnabled: true,
        updatedAt: true,
      },
    });
  });

  it('routes initiation only when the gateway is enabled and configured', async () => {
    config.get.mockImplementation((key: string, fallback: unknown) =>
      key === 'ZARINPAL_MERCHANT_ID' ? '00000000-0000-4000-8000-000000000001' : fallback,
    );
    prisma.paymentGatewaySetting.findUnique.mockResolvedValue({
      isEnabled: true,
    });
    zarinpal.initiate.mockResolvedValue({
      authority: 'AUTH-1',
      paymentUrl: 'https://gateway.example/AUTH-1',
    });

    await registry.initiate({
      provider: PAYMENT_GATEWAY_CODES.ZARINPAL,
      attemptId: '20000000-0000-4000-8000-000000000001',
      orderNumber: 'HS-TEST',
      amountRial: '10000000',
      callbackUrl: 'https://api.example.com/payments/callback',
    });

    expect(zarinpal.initiate).toHaveBeenCalledTimes(1);
  });

  it('does not require the gateway to remain enabled during verification', async () => {
    config.get.mockImplementation((key: string, fallback: unknown) =>
      key === 'ZARINPAL_MERCHANT_ID' ? '00000000-0000-4000-8000-000000000001' : fallback,
    );
    zarinpal.verify.mockResolvedValue({
      success: true,
      referenceId: 'REF-1',
    });

    await registry.verify({
      provider: PAYMENT_GATEWAY_CODES.ZARINPAL,
      authority: 'AUTH-1',
      amountRial: '10000000',
    });

    expect(prisma.paymentGatewaySetting.findUnique).not.toHaveBeenCalled();
    expect(zarinpal.verify).toHaveBeenCalledTimes(1);
  });

  it('rejects an enabled gateway when its credentials are missing', async () => {
    prisma.paymentGatewaySetting.findUnique.mockResolvedValue({
      isEnabled: true,
    });

    await expect(
      registry.initiate({
        provider: PAYMENT_GATEWAY_CODES.ZARINPAL,
        attemptId: '20000000-0000-4000-8000-000000000001',
        orderNumber: 'HS-TEST',
        amountRial: '10000000',
        callbackUrl: 'https://api.example.com/payments/callback',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('rejects unknown gateway setting keys', async () => {
    await expect(
      registry.updateGatewaySetting('unknown', true, actorUserId),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
