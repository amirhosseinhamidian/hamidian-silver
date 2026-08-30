import { NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { PricingService } from './pricing.service';

describe('PricingService', () => {
  const productId = '10000000-0000-4000-8000-000000000001';
  const supplierId = '20000000-0000-4000-8000-000000000001';
  const actorUserId = '30000000-0000-4000-8000-000000000001';

  const prisma = {
    supplier: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    product: {
      findFirst: jest.fn(),
    },
    productPriceHistory: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  let service: PricingService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PricingService(prisma as unknown as PrismaService);
  });

  it('normalizes supplier codes to uppercase', async () => {
    prisma.supplier.create.mockResolvedValue({
      id: supplierId,
      code: 'SUP-1',
    });

    await service.createSupplier({
      code: ' sup-1 ',
      name: 'Supplier One',
    });

    expect(prisma.supplier.create).toHaveBeenCalledWith({
      data: {
        code: 'SUP-1',
        name: 'Supplier One',
        contactName: undefined,
        phone: undefined,
        isActive: true,
      },
    });
  });

  it('updates supplier cost without changing the product sale price', async () => {
    const transaction = {
      product: {
        findFirst: jest.fn().mockResolvedValue({ id: productId }),
      },
      supplier: {
        findFirst: jest.fn().mockResolvedValue({ id: supplierId }),
      },
      productSupplier: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        upsert: jest.fn().mockResolvedValue({
          productId,
          supplierId,
          supplierPriceToman: 1_000_000,
          markupPercent: 25,
          isPreferred: true,
        }),
      },
    };

    prisma.$transaction.mockImplementation(
      async (callback: (client: typeof transaction) => Promise<unknown>) => callback(transaction),
    );

    await service.setProductSupplier(productId, supplierId, {
      supplierPriceToman: 1_000_000,
      markupPercent: 25,
      isPreferred: true,
    });

    expect(transaction.productSupplier.upsert).toHaveBeenCalled();
    expect(transaction.product).not.toHaveProperty('update');
  });

  it('rejects supplier pricing for a missing product', async () => {
    const transaction = {
      product: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      supplier: {
        findFirst: jest.fn().mockResolvedValue({ id: supplierId }),
      },
      productSupplier: {
        updateMany: jest.fn(),
        upsert: jest.fn(),
      },
    };

    prisma.$transaction.mockImplementation(
      async (callback: (client: typeof transaction) => Promise<unknown>) => callback(transaction),
    );

    await expect(
      service.setProductSupplier(productId, supplierId, {
        supplierPriceToman: 1_000_000,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('records sale-price history before changing the current price', async () => {
    const transaction = {
      product: {
        findFirst: jest.fn().mockResolvedValue({
          id: productId,
          salePriceToman: 1_200_000,
        }),
        update: jest.fn().mockResolvedValue({
          id: productId,
          name: 'Silver Ring',
          slug: 'silver-ring',
          salePriceToman: 1_350_000,
        }),
        findUniqueOrThrow: jest.fn(),
      },
      productPriceHistory: {
        create: jest.fn().mockResolvedValue({}),
      },
    };

    prisma.$transaction.mockImplementation(
      async (callback: (client: typeof transaction) => Promise<unknown>) => callback(transaction),
    );

    await service.setSalePrice(
      productId,
      {
        salePriceToman: 1_350_000,
        reason: 'Manager price update',
      },
      actorUserId,
    );

    expect(transaction.productPriceHistory.create).toHaveBeenCalledWith({
      data: {
        productId,
        changedByUserId: actorUserId,
        previousPriceToman: 1_200_000,
        newPriceToman: 1_350_000,
        reason: 'Manager price update',
      },
    });

    expect(transaction.product.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          salePriceToman: 1_350_000,
        },
      }),
    );
  });

  it('does not create duplicate history for a no-op price change', async () => {
    const transaction = {
      product: {
        findFirst: jest.fn().mockResolvedValue({
          id: productId,
          salePriceToman: 1_350_000,
        }),
        update: jest.fn(),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: productId,
          name: 'Silver Ring',
          slug: 'silver-ring',
          salePriceToman: 1_350_000,
        }),
      },
      productPriceHistory: {
        create: jest.fn(),
      },
    };

    prisma.$transaction.mockImplementation(
      async (callback: (client: typeof transaction) => Promise<unknown>) => callback(transaction),
    );

    await service.setSalePrice(
      productId,
      {
        salePriceToman: 1_350_000,
      },
      actorUserId,
    );

    expect(transaction.productPriceHistory.create).not.toHaveBeenCalled();
    expect(transaction.product.update).not.toHaveBeenCalled();
  });
});
