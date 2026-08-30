import { BadRequestException } from '@nestjs/common';
import { PlatingType } from '../../generated/prisma/enums';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { PlatingService } from './plating.service';

describe('PlatingService', () => {
  const actorUserId = '10000000-0000-4000-8000-000000000001';
  const rateId = '20000000-0000-4000-8000-000000000001';
  const variantId = '30000000-0000-4000-8000-000000000001';

  const prisma = {
    platingRate: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    platingRateHistory: {
      findMany: jest.fn(),
    },
    productVariant: {
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  let service: PlatingService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PlatingService(prisma as unknown as PrismaService);
  });

  it('creates a plating rate and its initial history entry', async () => {
    const transaction = {
      platingRate: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: rateId,
          type: PlatingType.GOLD,
          pricePerGramToman: 50_000,
          leadTimeDays: 2,
          isActive: true,
        }),
        update: jest.fn(),
      },
      platingRateHistory: {
        create: jest.fn().mockResolvedValue({}),
      },
    };

    prisma.$transaction.mockImplementation(
      async (callback: (client: typeof transaction) => Promise<unknown>) => callback(transaction),
    );

    await service.setRate(
      PlatingType.GOLD,
      {
        pricePerGramToman: 50_000,
        leadTimeDays: 2,
        reason: 'Initial gold plating rate',
      },
      actorUserId,
    );

    expect(transaction.platingRateHistory.create).toHaveBeenCalledWith({
      data: {
        platingRateId: rateId,
        changedByUserId: actorUserId,
        previousPricePerGramToman: undefined,
        newPricePerGramToman: 50_000,
        previousLeadTimeDays: undefined,
        newLeadTimeDays: 2,
        reason: 'Initial gold plating rate',
      },
    });
  });

  it('does not create duplicate history for a no-op rate update', async () => {
    const transaction = {
      platingRate: {
        findUnique: jest.fn().mockResolvedValue({
          id: rateId,
          type: PlatingType.RHODIUM,
          pricePerGramToman: 30_000,
          leadTimeDays: 1,
          isActive: true,
        }),
        create: jest.fn(),
        update: jest.fn(),
      },
      platingRateHistory: {
        create: jest.fn(),
      },
    };

    prisma.$transaction.mockImplementation(
      async (callback: (client: typeof transaction) => Promise<unknown>) => callback(transaction),
    );

    await service.setRate(
      PlatingType.RHODIUM,
      {
        pricePerGramToman: 30_000,
        leadTimeDays: 1,
      },
      actorUserId,
    );

    expect(transaction.platingRate.update).not.toHaveBeenCalled();
    expect(transaction.platingRateHistory.create).not.toHaveBeenCalled();
  });

  it('disables variant options when plating eligibility is turned off', async () => {
    const transaction = {
      productVariant: {
        findFirst: jest.fn().mockResolvedValue({ id: variantId }),
        update: jest.fn().mockResolvedValue({
          id: variantId,
          sku: 'RING-52',
          weightGrams: '4.250',
          platingEligible: false,
        }),
      },
      productPlatingOption: {
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
    };

    prisma.$transaction.mockImplementation(
      async (callback: (client: typeof transaction) => Promise<unknown>) => callback(transaction),
    );

    await service.setVariantEligibility(variantId, {
      platingEligible: false,
    });

    expect(transaction.productPlatingOption.updateMany).toHaveBeenCalledWith({
      where: {
        variantId,
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });
  });

  it('quotes plating from variant weight and the current per-gram rate', async () => {
    prisma.productVariant.findFirst.mockResolvedValue({
      id: variantId,
      sku: 'RING-52',
      weightGrams: {
        toString: () => '4.250',
      },
      platingOptions: [
        {
          platingRate: {
            type: PlatingType.GOLD,
            pricePerGramToman: 50_000,
            leadTimeDays: 2,
          },
        },
      ],
    });

    await expect(service.quoteVariant(variantId, PlatingType.GOLD)).resolves.toEqual({
      variantId,
      sku: 'RING-52',
      platingType: PlatingType.GOLD,
      weightGrams: '4.250',
      pricePerGramToman: 50_000,
      platingPriceToman: 212_500,
      leadTimeDays: 2,
    });
  });

  it('rejects plating quote when the variant weight is missing', async () => {
    prisma.productVariant.findFirst.mockResolvedValue({
      id: variantId,
      sku: 'RING-52',
      weightGrams: null,
      platingOptions: [
        {
          platingRate: {
            type: PlatingType.GOLD,
            pricePerGramToman: 50_000,
            leadTimeDays: 2,
          },
        },
      ],
    });

    await expect(service.quoteVariant(variantId, PlatingType.GOLD)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
