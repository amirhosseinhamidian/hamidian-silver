import { BadRequestException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { ShippingPricingService } from './shipping-pricing.service';

describe('ShippingPricingService', () => {
  const actorUserId = '10000000-0000-4000-8000-000000000001';
  const prisma = {
    shippingPricingSettings: { findUnique: jest.fn(), upsert: jest.fn() },
  };

  beforeEach(() => jest.clearAllMocks());

  it('keeps the environment cost as fallback until settings are saved', async () => {
    prisma.shippingPricingSettings.findUnique.mockResolvedValue(null);
    const config = { get: jest.fn(() => 85_000) };
    const service = new ShippingPricingService(
      prisma as unknown as PrismaService,
      config as unknown as ConfigService,
    );

    await expect(service.getAdminSettings()).resolves.toEqual({
      mode: 'FIXED',
      baseCostToman: 85_000,
      thresholdToman: null,
      discountedCostToman: null,
      source: 'ENVIRONMENT',
      updatedByUserId: null,
      updatedAt: null,
    });
  });

  it('uses the lower cost at and above the subtotal threshold', async () => {
    prisma.shippingPricingSettings.findUnique.mockResolvedValue({
      mode: 'FIXED',
      baseCostToman: 100_000,
      thresholdToman: 3_000_000,
      discountedCostToman: 25_000,
      updatedByUserId: actorUserId,
      updatedAt: new Date(),
    });
    const service = new ShippingPricingService(prisma as unknown as PrismaService);

    await expect(service.calculateCostToman(2_999_999)).resolves.toBe(100_000);
    await expect(service.calculateCostToman(3_000_000)).resolves.toBe(25_000);
  });

  it('supports free shipping after the threshold and rejects a non-reduced tier', async () => {
    prisma.shippingPricingSettings.findUnique.mockResolvedValue({
      mode: 'FIXED',
      baseCostToman: 100_000,
      thresholdToman: 3_000_000,
      discountedCostToman: 0,
      updatedByUserId: actorUserId,
      updatedAt: new Date(),
    });
    const service = new ShippingPricingService(prisma as unknown as PrismaService);

    await expect(service.calculateCostToman(4_000_000)).resolves.toBe(0);
    await expect(
      service.updateSettings(
        {
          mode: 'FIXED',
          baseCostToman: 100_000,
          thresholdToman: 3_000_000,
          discountedCostToman: 100_000,
        },
        actorUserId,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
