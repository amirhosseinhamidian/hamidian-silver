import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ProductStatus, SizeMode } from '../../generated/prisma/enums';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { CatalogService } from './catalog.service';
import type { CreateProductDto } from './dto/create-product.dto';

describe('CatalogService', () => {
  const prisma = {
    media: {
      create: jest.fn(),
      findFirst: jest.fn(),
    },
    category: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    brand: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    country: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    size: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    product: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  let service: CatalogService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CatalogService(prisma as unknown as PrismaService);
  });

  it('requires category image media to exist', async () => {
    prisma.media.findFirst.mockResolvedValue(null);

    await expect(
      service.createCategory({
        name: 'Rings',
        slug: 'rings',
        imageId: '10000000-0000-4000-8000-000000000001',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.category.create).not.toHaveBeenCalled();
  });

  it('normalizes country ISO codes to uppercase', async () => {
    prisma.country.create.mockResolvedValue({
      id: '10000000-0000-4000-8000-000000000001',
    });

    await service.createCountry({
      name: 'Iran',
      slug: 'iran',
      isoCode: 'ir',
    });

    expect(prisma.country.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          isoCode: 'IR',
        }),
      }),
    );
  });

  it('rejects a product without variants', async () => {
    await expect(
      service.createProduct({
        name: 'Silver Ring',
        slug: 'silver-ring',
        sizeMode: SizeMode.NONE,
        variants: [],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects a size on a non-sized product', async () => {
    await expect(
      service.createProduct({
        name: 'Silver Pendant',
        slug: 'silver-pendant',
        sizeMode: SizeMode.FREE_SIZE,
        variants: [
          {
            sku: 'PENDANT-1',
            sizeId: '10000000-0000-4000-8000-000000000001',
          },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires every sized variant to have a unique size', async () => {
    const sizeId = '10000000-0000-4000-8000-000000000001';

    await expect(
      service.createProduct({
        name: 'Silver Ring',
        slug: 'silver-ring',
        sizeMode: SizeMode.SIZED,
        variants: [
          {
            sku: 'RING-1',
            sizeId,
          },
          {
            sku: 'RING-2',
            sizeId,
          },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates a product and all catalog relations in one transaction', async () => {
    const brandId = '10000000-0000-4000-8000-000000000001';
    const countryId = '10000000-0000-4000-8000-000000000002';
    const categoryId = '10000000-0000-4000-8000-000000000003';
    const sizeId = '10000000-0000-4000-8000-000000000004';
    const mediaId = '10000000-0000-4000-8000-000000000005';
    const productId = '10000000-0000-4000-8000-000000000006';

    const transaction = {
      brand: {
        findFirst: jest.fn().mockResolvedValue({ id: brandId }),
      },
      country: {
        findFirst: jest.fn().mockResolvedValue({ id: countryId }),
      },
      category: {
        findMany: jest.fn().mockResolvedValue([{ id: categoryId }]),
      },
      size: {
        findMany: jest.fn().mockResolvedValue([{ id: sizeId }]),
      },
      media: {
        findMany: jest.fn().mockResolvedValue([{ id: mediaId }]),
      },
      product: {
        create: jest.fn().mockResolvedValue({ id: productId }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: productId,
          name: 'Silver Ring',
        }),
      },
      productCategory: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      productVariant: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      productMedia: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };

    prisma.$transaction.mockImplementation(
      async (callback: (client: typeof transaction) => Promise<unknown>) => callback(transaction),
    );

    const dto: CreateProductDto = {
      name: 'Silver Ring',
      slug: 'silver-ring',
      status: ProductStatus.ACTIVE,
      sizeMode: SizeMode.SIZED,
      brandId,
      countryId,
      categoryIds: [categoryId],
      variants: [
        {
          sku: 'RING-52',
          sizeId,
          weightGrams: 4.25,
        },
      ],
      media: [
        {
          mediaId,
          isPrimary: true,
        },
      ],
    };

    await expect(service.createProduct(dto)).resolves.toEqual({
      id: productId,
      name: 'Silver Ring',
    });

    expect(transaction.product.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: 'Silver Ring',
        slug: 'silver-ring',
        status: ProductStatus.ACTIVE,
        sizeMode: SizeMode.SIZED,
        brandId,
        countryId,
      }),
      select: {
        id: true,
      },
    });

    expect(transaction.productVariant.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          productId,
          sku: 'RING-52',
          sizeId,
          weightGrams: 4.25,
        }),
      ],
    });

    expect(transaction.productMedia.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          productId,
          mediaId,
          isPrimary: true,
        }),
      ],
    });
  });

  it('rejects more than one primary product media item', async () => {
    const dto: CreateProductDto = {
      name: 'Silver Necklace',
      slug: 'silver-necklace',
      sizeMode: SizeMode.NONE,
      variants: [{ sku: 'NECKLACE-1' }],
      media: [
        {
          mediaId: '10000000-0000-4000-8000-000000000001',
          isPrimary: true,
        },
        {
          mediaId: '10000000-0000-4000-8000-000000000002',
          isPrimary: true,
        },
      ],
    };

    await expect(service.createProduct(dto)).rejects.toBeInstanceOf(BadRequestException);
  });
});
