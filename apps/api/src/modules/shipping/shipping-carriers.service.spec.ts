import { BadRequestException } from '@nestjs/common';

import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { ShippingCarriersService } from './shipping-carriers.service';

describe('ShippingCarriersService checkout pricing', () => {
  const carrierId = '10000000-0000-4000-8000-000000000001';
  const prisma = {
    shippingCarrier: { findFirst: jest.fn(), findMany: jest.fn() },
  };
  const service = new ShippingCarriersService(prisma as unknown as PrismaService);

  beforeEach(() => jest.clearAllMocks());

  it('includes the admin-managed subtitle in public checkout options', async () => {
    prisma.shippingCarrier.findMany.mockResolvedValue([
      {
        id: carrierId,
        name: 'ماهکس',
        subtitle: 'تحویل سریع‌تر با رهگیری آنلاین مرسوله',
        trackingUrl: 'https://tracking.example/',
        logoMediaId: null,
        logo: null,
        pricingMode: 'FIXED',
        baseCostToman: 189_000,
        thresholdToman: null,
        discountedCostToman: null,
        serviceArea: 'NATIONWIDE',
        isActive: true,
        updatedByUserId: null,
        createdAt: new Date('2026-09-20T00:00:00.000Z'),
        updatedAt: new Date('2026-09-20T00:00:00.000Z'),
      },
    ]);

    await expect(service.listPublicOptions()).resolves.toEqual([
      expect.objectContaining({
        name: 'ماهکس',
        subtitle: 'تحویل سریع‌تر با رهگیری آنلاین مرسوله',
        baseCostToman: 189_000,
      }),
    ]);
  });

  it('calculates a selected carrier threshold price and returns an immutable snapshot', async () => {
    prisma.shippingCarrier.findFirst.mockResolvedValue({
      id: carrierId,
      name: 'پست پیشتاز',
      subtitle: 'ارسال اقتصادی با پوشش سراسری کشور',
      trackingUrl: 'https://tracking.example/',
      logoMediaId: null,
      pricingMode: 'FIXED',
      baseCostToman: 100_000,
      thresholdToman: 3_000_000,
      discountedCostToman: 0,
      serviceArea: 'NATIONWIDE',
    });

    await expect(
      service.quoteForCheckout(
        carrierId,
        3_000_000,
        { province: 'اصفهان', city: 'اصفهان' },
        prisma as never,
      ),
    ).resolves.toEqual({
      costToman: 0,
      snapshot: expect.objectContaining({
        shippingCarrierIdSnapshot: carrierId,
        shippingCarrierNameSnapshot: 'پست پیشتاز',
        shippingPricingModeSnapshot: 'FIXED',
      }),
    });
  });

  it('allows collect-on-delivery courier only in Tehran city', async () => {
    prisma.shippingCarrier.findFirst.mockResolvedValue({
      id: carrierId,
      name: 'پیک تهران',
      subtitle: 'تحویل سریع در محدوده شهر تهران',
      trackingUrl: null,
      logoMediaId: null,
      pricingMode: 'COLLECT',
      baseCostToman: 0,
      thresholdToman: null,
      discountedCostToman: null,
      serviceArea: 'TEHRAN_ONLY',
    });

    await expect(
      service.quoteForCheckout(
        carrierId,
        1_000_000,
        { province: 'تهران', city: 'تهران' },
        prisma as never,
      ),
    ).resolves.toEqual(expect.objectContaining({ costToman: 0 }));
    await expect(
      service.quoteForCheckout(
        carrierId,
        1_000_000,
        { province: 'تهران', city: 'شهریار' },
        prisma as never,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
