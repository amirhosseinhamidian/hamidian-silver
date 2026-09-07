import { BadRequestException, ConflictException } from '@nestjs/common';
import { ProductStatus, SizeMode } from '../../generated/prisma/enums';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { CatalogVariantsService } from './catalog-variants.service';

describe('CatalogVariantsService', () => {
  const prisma = {
    size: { create: jest.fn(), findMany: jest.fn() },
    $transaction: jest.fn(),
  };
  let service: CatalogVariantsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CatalogVariantsService(prisma as unknown as PrismaService);
  });

  it('requires a size when adding a variant to a sized product', async () => {
    const transaction = {
      product: {
        findFirst: jest.fn().mockResolvedValue({ id: 'product-1', sizeMode: SizeMode.SIZED }),
      },
      productVariant: { create: jest.fn() },
      size: { findFirst: jest.fn() },
    };
    prisma.$transaction.mockImplementation(
      async (callback: (client: typeof transaction) => Promise<unknown>) => callback(transaction),
    );

    await expect(service.createVariant('product-1', { sku: 'RING-52' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(transaction.productVariant.create).not.toHaveBeenCalled();
  });

  it('creates a variant with an active catalog size', async () => {
    const sizeId = '10000000-0000-4000-8000-000000000001';
    const transaction = {
      product: {
        findFirst: jest.fn().mockResolvedValue({ id: 'product-1', sizeMode: SizeMode.SIZED }),
      },
      size: { findFirst: jest.fn().mockResolvedValue({ id: sizeId }) },
      productVariant: {
        create: jest.fn().mockResolvedValue({ id: 'variant-1', sku: 'RING-52' }),
      },
    };
    prisma.$transaction.mockImplementation(
      async (callback: (client: typeof transaction) => Promise<unknown>) => callback(transaction),
    );

    await expect(
      service.createVariant('product-1', { sku: ' RING-52 ', sizeId, weightGrams: 4.25 }),
    ).resolves.toMatchObject({ id: 'variant-1' });
    expect(transaction.productVariant.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        productId: 'product-1',
        sku: 'RING-52',
        sizeId,
        weightGrams: 4.25,
        isActive: true,
      }),
      include: { size: true },
    });
  });

  it('keeps at least one active variant on a published product', async () => {
    const transaction = {
      productVariant: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'variant-1',
          sizeId: null,
          isActive: true,
          product: { sizeMode: SizeMode.NONE, status: ProductStatus.ACTIVE },
        }),
        count: jest.fn().mockResolvedValue(0),
        update: jest.fn(),
      },
      size: { findFirst: jest.fn() },
    };
    prisma.$transaction.mockImplementation(
      async (callback: (client: typeof transaction) => Promise<unknown>) => callback(transaction),
    );

    await expect(
      service.updateVariant('product-1', 'variant-1', { isActive: false }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(transaction.productVariant.update).not.toHaveBeenCalled();
  });

  it('does not deactivate a size used by active variants', async () => {
    const transaction = {
      size: {
        findFirst: jest.fn().mockResolvedValue({ id: 'size-1', isActive: true }),
        update: jest.fn(),
      },
      productVariant: { count: jest.fn().mockResolvedValue(2) },
    };
    prisma.$transaction.mockImplementation(
      async (callback: (client: typeof transaction) => Promise<unknown>) => callback(transaction),
    );

    await expect(service.updateSize('size-1', { isActive: false })).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(transaction.size.update).not.toHaveBeenCalled();
  });

  it('maps unique SKU conflicts to a catalog conflict response', async () => {
    prisma.$transaction.mockRejectedValue({ code: 'P2002' });
    await expect(service.createVariant('product-1', { sku: 'DUPLICATE' })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
