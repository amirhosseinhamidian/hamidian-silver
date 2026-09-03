import { PlatingType } from '../../generated/prisma/enums';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { CatalogService } from './catalog.service';
import type { PublicMediaUrlService } from './public-media-url.service';

describe('CatalogService commerce projection', () => {
  const prisma = {
    product: {
      findFirst: jest.fn(),
    },
  };
  const publicMediaUrl = {
    resolve: jest.fn((storageKey: string) => `https://media.hamidian.shop/${storageKey}`),
  };

  let service: CatalogService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CatalogService(
      prisma as unknown as PrismaService,
      publicMediaUrl as unknown as PublicMediaUrlService,
    );
  });

  it('exposes current purchasable plating options with server-calculated unit prices', async () => {
    prisma.product.findFirst.mockResolvedValue({
      id: '10000000-0000-4000-8000-000000000001',
      name: 'Silver Ring',
      slug: 'silver-ring',
      shortDescription: null,
      description: null,
      salePriceToman: 850_000,
      sizeMode: 'SIZED',
      brand: null,
      country: null,
      categories: [],
      variants: [
        {
          id: '10000000-0000-4000-8000-000000000002',
          name: null,
          weightGrams: {
            toString: () => '4.250',
            valueOf: () => 4.25,
          },
          platingEligible: true,
          platingOptions: [
            {
              platingRate: {
                type: PlatingType.GOLD,
                pricePerGramToman: 5_000,
                leadTimeDays: 2,
              },
            },
          ],
          size: {
            id: '10000000-0000-4000-8000-000000000003',
            code: '52',
            label: '52',
            isActive: true,
            deletedAt: null,
          },
          inventories: [
            {
              onHand: 3,
              reserved: 1,
              warehouse: {
                isActive: true,
                deletedAt: null,
              },
            },
          ],
        },
      ],
      media: [],
    });

    const product = await service.getPublicProduct('silver-ring');

    expect(product.variants).toEqual([
      expect.objectContaining({
        id: '10000000-0000-4000-8000-000000000002',
        availableQuantity: 2,
        isAvailable: true,
        platingOptions: [
          {
            type: PlatingType.GOLD,
            unitPriceToman: 21_250,
            leadTimeDays: 2,
          },
        ],
      }),
    ]);

    expect(prisma.product.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          variants: expect.objectContaining({
            select: expect.objectContaining({
              platingEligible: true,
              platingOptions: {
                where: {
                  isActive: true,
                  platingRate: {
                    isActive: true,
                  },
                },
                select: {
                  platingRate: {
                    select: {
                      type: true,
                      pricePerGramToman: true,
                      leadTimeDays: true,
                    },
                  },
                },
              },
            }),
          }),
        }),
      }),
    );
  });
});
