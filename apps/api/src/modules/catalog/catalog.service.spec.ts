import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ProductStatus, SizeMode } from '../../generated/prisma/enums';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { CatalogService } from './catalog.service';
import type { PublicMediaUrlService } from './public-media-url.service';
import type { CreateProductDto } from './dto/create-product.dto';
import { PublicCatalogSort } from './dto/public-catalog-query.dto';

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
      findFirst: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
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

  it('filters and paginates the administrative product list', async () => {
    const products = [{ id: '10000000-0000-4000-8000-000000000001', media: [] }];
    prisma.$transaction.mockResolvedValue([products, 21]);

    await expect(
      service.listProducts({ q: 'ring', status: ProductStatus.ACTIVE, page: 2, limit: 10 }),
    ).resolves.toEqual({ items: products, total: 21, page: 2, limit: 10 });

    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10,
        take: 10,
        where: expect.objectContaining({ status: ProductStatus.ACTIVE }),
      }),
    );
  });

  it('updates product fields and replaces category assignments atomically', async () => {
    const productId = '10000000-0000-4000-8000-000000000001';
    const categoryId = '10000000-0000-4000-8000-000000000002';
    const transaction = {
      product: {
        findFirst: jest.fn().mockResolvedValue({
          id: productId,
          salePriceToman: 4_000_000,
          compareAtPriceToman: 5_000_000,
        }),
        update: jest.fn(),
        findUniqueOrThrow: jest
          .fn()
          .mockResolvedValue({ id: productId, name: 'Updated ring', media: [] }),
      },
      brand: { findFirst: jest.fn() },
      country: { findFirst: jest.fn() },
      category: { findMany: jest.fn().mockResolvedValue([{ id: categoryId }]) },
      productCategory: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
    };
    prisma.$transaction.mockImplementation(
      async (callback: (client: typeof transaction) => Promise<unknown>) => callback(transaction),
    );

    await expect(
      service.updateProduct(productId, {
        name: 'Updated ring',
        salePriceToman: 4_200_000,
        categoryIds: [categoryId],
      }),
    ).resolves.toEqual({ id: productId, name: 'Updated ring', media: [] });

    expect(transaction.product.update).toHaveBeenCalledWith({
      where: { id: productId },
      data: expect.objectContaining({ name: 'Updated ring', salePriceToman: 4_200_000 }),
    });
    expect(transaction.productCategory.deleteMany).toHaveBeenCalledWith({
      where: { productId },
    });
    expect(transaction.productCategory.createMany).toHaveBeenCalledWith({
      data: [{ productId, categoryId }],
    });
  });

  it('archives a product through the shared status transition', async () => {
    const productId = '10000000-0000-4000-8000-000000000001';
    prisma.product.findFirst.mockResolvedValue({ id: productId });
    prisma.product.update.mockResolvedValue({ id: productId, status: ProductStatus.ARCHIVED });

    await expect(service.updateProductStatus(productId, ProductStatus.ARCHIVED)).resolves.toEqual({
      id: productId,
      status: ProductStatus.ARCHIVED,
    });
    expect(prisma.product.update).toHaveBeenCalledWith({
      where: { id: productId },
      data: { status: ProductStatus.ARCHIVED },
    });
  });

  it('returns only active categories through the public catalog projection', async () => {
    prisma.category.findMany.mockResolvedValue([
      {
        id: '10000000-0000-4000-8000-000000000001',
        name: 'Rings',
        slug: 'rings',
        description: null,
        parentId: null,
        sortOrder: 0,
        image: {
          storageKey: 'categories/rings.jpg',
          mimeType: 'image/jpeg',
          altText: 'Silver rings',
          width: 1200,
          height: 1200,
          deletedAt: null,
        },
      },
    ]);

    await expect(service.listPublicCategories()).resolves.toEqual([
      {
        id: '10000000-0000-4000-8000-000000000001',
        name: 'Rings',
        slug: 'rings',
        description: null,
        parentId: null,
        sortOrder: 0,
        image: {
          url: 'https://media.hamidian.shop/categories/rings.jpg',
          mimeType: 'image/jpeg',
          altText: 'Silver rings',
          width: 1200,
          height: 1200,
        },
      },
    ]);

    expect(prisma.category.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          isActive: true,
          deletedAt: null,
        },
      }),
    );
  });

  it('paginates public products and excludes internal supplier data from the query', async () => {
    prisma.category.findMany.mockResolvedValue([
      {
        id: '10000000-0000-4000-8000-000000000001',
        slug: 'rings',
        parentId: null,
      },
    ]);
    prisma.product.findMany.mockResolvedValue([]);

    await expect(
      service.listPublicProducts({
        page: 2,
        pageSize: 12,
        category: 'rings',
      }),
    ).resolves.toEqual({
      items: [],
      page: 2,
      pageSize: 12,
      total: 0,
      totalPages: 0,
    });

    const query = prisma.product.findMany.mock.calls[0]?.[0];

    expect(query).toEqual(
      expect.objectContaining({
        where: expect.objectContaining({
          status: ProductStatus.ACTIVE,
          deletedAt: null,
        }),
      }),
    );
    expect(query.select).not.toHaveProperty('suppliers');
    expect(query.select).not.toHaveProperty('priceHistory');
    expect(query).not.toHaveProperty('skip');
    expect(query).not.toHaveProperty('take');
    expect(prisma.product.count).not.toHaveBeenCalled();
  });

  it('includes active descendant categories when filtering a parent collection', async () => {
    const parentId = '10000000-0000-4000-8000-000000000001';
    const childId = '10000000-0000-4000-8000-000000000002';
    const grandchildId = '10000000-0000-4000-8000-000000000003';

    prisma.category.findMany.mockResolvedValue([
      { id: parentId, slug: 'jewelry', parentId: null },
      { id: childId, slug: 'rings', parentId },
      { id: grandchildId, slug: 'silver-rings', parentId: childId },
    ]);
    prisma.product.findMany.mockResolvedValue([]);

    await service.listPublicProducts({
      category: 'jewelry',
    });

    expect(prisma.category.findMany).toHaveBeenCalledWith({
      where: {
        isActive: true,
        deletedAt: null,
      },
      select: {
        id: true,
        slug: true,
        parentId: true,
      },
    });

    const query = prisma.product.findMany.mock.calls[0]?.[0];
    const categoryIds = query?.where?.categories?.some?.categoryId?.in;

    expect(categoryIds).toEqual(expect.arrayContaining([parentId, childId, grandchildId]));
    expect(categoryIds).toHaveLength(3);
  });

  it('uses deterministic price ordering and keeps null prices last', async () => {
    prisma.product.findMany.mockResolvedValue([]);

    await service.listPublicProducts({
      sort: PublicCatalogSort.PRICE_ASC,
    });

    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [
          {
            salePriceToman: {
              sort: 'asc',
              nulls: 'last',
            },
          },
          { createdAt: 'desc' },
          { id: 'asc' },
        ],
      }),
    );
  });

  it('prioritizes available products before paginating while preserving catalog order', async () => {
    const availableFirstId = '10000000-0000-4000-8000-000000000011';
    const unavailableId = '10000000-0000-4000-8000-000000000012';
    const availableSecondId = '10000000-0000-4000-8000-000000000013';
    const activeWarehouse = {
      isActive: true,
      deletedAt: null,
    };

    prisma.product.findMany
      .mockResolvedValueOnce([
        {
          id: availableFirstId,
          variants: [
            {
              inventories: [{ onHand: 2, reserved: 1, warehouse: activeWarehouse }],
            },
          ],
        },
        {
          id: unavailableId,
          variants: [
            {
              inventories: [{ onHand: 1, reserved: 1, warehouse: activeWarehouse }],
            },
          ],
        },
        {
          id: availableSecondId,
          variants: [
            {
              inventories: [{ onHand: 3, reserved: 0, warehouse: activeWarehouse }],
            },
          ],
        },
      ])
      .mockResolvedValueOnce([
        {
          id: availableSecondId,
          name: 'Available second',
          slug: 'available-second',
          shortDescription: null,
          salePriceToman: 900_000,
          compareAtPriceToman: null,
          sizeMode: SizeMode.NONE,
          brand: null,
          categories: [],
          media: [],
        },
        {
          id: availableFirstId,
          name: 'Available first',
          slug: 'available-first',
          shortDescription: null,
          salePriceToman: 800_000,
          compareAtPriceToman: null,
          sizeMode: SizeMode.NONE,
          brand: null,
          categories: [],
          media: [],
        },
      ]);

    await expect(
      service.listPublicProducts({
        page: 1,
        pageSize: 2,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        items: [
          expect.objectContaining({
            id: availableFirstId,
            availableQuantity: 1,
            isAvailable: true,
          }),
          expect.objectContaining({
            id: availableSecondId,
            availableQuantity: 3,
            isAvailable: true,
          }),
        ],
        page: 1,
        pageSize: 2,
        total: 3,
        totalPages: 2,
      }),
    );

    expect(prisma.product.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: {
          id: {
            in: [availableFirstId, availableSecondId],
          },
        },
      }),
    );
  });

  it('does not expose a non-active product through its public slug', async () => {
    prisma.product.findFirst.mockResolvedValue(null);

    await expect(service.getPublicProduct('hidden-product')).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(prisma.product.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          slug: 'hidden-product',
          status: ProductStatus.ACTIVE,
          deletedAt: null,
        },
      }),
    );
  });
});
