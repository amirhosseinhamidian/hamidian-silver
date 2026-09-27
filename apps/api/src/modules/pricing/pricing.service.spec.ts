import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { resolveHumanAuditEvent } from '../audit/audit-event';
import { PricingService } from './pricing.service';

describe('PricingService', () => {
  const productId = '10000000-0000-4000-8000-000000000001';
  const supplierId = '20000000-0000-4000-8000-000000000001';
  const actorUserId = '30000000-0000-4000-8000-000000000001';
  const supplierSourceId = '40000000-0000-4000-8000-000000000001';

  const prisma = {
    supplier: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    supplierSource: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    product: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    productPriceHistory: {
      findMany: jest.fn(),
    },
    platingRate: {
      findMany: jest.fn(),
    },
    platingRateHistory: {
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

  it('deactivates product links when a supplier is disabled', async () => {
    const transaction = {
      supplier: {
        findFirst: jest.fn().mockResolvedValue({ id: supplierId }),
        update: jest.fn().mockResolvedValue({ id: supplierId, isActive: false }),
      },
      productSupplier: {
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      supplierSource: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    prisma.$transaction.mockImplementation(
      async (callback: (client: typeof transaction) => Promise<unknown>) => callback(transaction),
    );

    await service.updateSupplier(supplierId, { isActive: false });

    expect(transaction.productSupplier.updateMany).toHaveBeenCalledWith({
      where: { supplierId, OR: [{ isActive: true }, { isPreferred: true }] },
      data: { isActive: false, isPreferred: false },
    });
    expect(transaction.supplierSource.updateMany).toHaveBeenCalledWith({
      where: { supplierId, isActive: true, deletedAt: null },
      data: { isActive: false },
    });
    expect(transaction.supplier.update).toHaveBeenCalledWith({
      where: { id: supplierId },
      data: { isActive: false },
    });
  });

  it('normalizes and stores a dynamic supplier website', async () => {
    prisma.supplier.findFirst.mockResolvedValue({ id: supplierId, isActive: true });
    prisma.supplierSource.create.mockResolvedValue({ id: supplierSourceId });

    await service.createSupplierSource(supplierId, {
      name: ' فروشگاه اصلی ',
      baseUrl: 'https://BSJSilver.com/?campaign=test#products',
      crawlerType: 'CUSTOM_ADAPTER',
      adapterKey: 'bsj-silver',
      crawlDelayMs: 2500,
      maxConcurrency: 1,
    });

    expect(prisma.supplierSource.create).toHaveBeenCalledWith({
      data: {
        supplierId,
        name: 'فروشگاه اصلی',
        baseUrl: 'https://bsjsilver.com/',
        hostname: 'bsjsilver.com',
        crawlerType: 'CUSTOM_ADAPTER',
        adapterKey: 'bsj-silver',
        crawlDelayMs: 2500,
        maxConcurrency: 1,
        isActive: true,
      },
      include: { crawlRuns: true },
    });
  });

  it('requires an adapter key for custom supplier crawlers', async () => {
    prisma.supplier.findFirst.mockResolvedValue({ id: supplierId, isActive: true });

    await expect(
      service.createSupplierSource(supplierId, {
        name: 'فروشگاه اصلی',
        baseUrl: 'https://bsjsilver.com',
        crawlerType: 'CUSTOM_ADAPTER',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.supplierSource.create).not.toHaveBeenCalled();
  });

  it('returns the supplier directory and product sourcing catalog together', async () => {
    prisma.supplier.findMany.mockResolvedValue([{ id: supplierId, name: 'Supplier One' }]);
    prisma.product.findMany.mockResolvedValue([{ id: productId, name: 'Product One' }]);

    await expect(service.getSupplierCatalog()).resolves.toEqual({
      suppliers: [{ id: supplierId, name: 'Supplier One' }],
      products: [{ id: productId, name: 'Product One' }],
    });
  });

  it('records sale-price history before changing the current price', async () => {
    const transaction = {
      product: {
        findFirst: jest.fn().mockResolvedValue({
          id: productId,
          salePriceToman: 1_200_000,
          compareAtPriceToman: null,
        }),
        update: jest.fn().mockResolvedValue({
          id: productId,
          name: 'Silver Ring',
          slug: 'silver-ring',
          salePriceToman: 1_350_000,
          compareAtPriceToman: 1_500_000,
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

    const result = await service.setSalePrice(
      productId,
      {
        salePriceToman: 1_350_000,
        compareAtPriceToman: 1_500_000,
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
        previousCompareAtPriceToman: null,
        newCompareAtPriceToman: 1_500_000,
        reason: 'Manager price update',
      },
    });

    expect(transaction.product.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          salePriceToman: 1_350_000,
          compareAtPriceToman: 1_500_000,
        },
      }),
    );
    expect(
      resolveHumanAuditEvent(
        result,
        { action: 'PATCH /pricing/products/:id/sale-price', resource: 'pricing', method: 'PATCH' },
        'SUCCESS',
      ),
    ).toEqual(
      expect.objectContaining({
        title: 'قیمت فروش Silver Ring از 1200000 تومان به 1350000 تومان تغییر کرد.',
        operationType: 'PRICE_CHANGE',
      }),
    );
  });

  it('does not create duplicate history for a no-op price change', async () => {
    const transaction = {
      product: {
        findFirst: jest.fn().mockResolvedValue({
          id: productId,
          salePriceToman: 1_350_000,
          compareAtPriceToman: null,
        }),
        update: jest.fn(),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: productId,
          name: 'Silver Ring',
          slug: 'silver-ring',
          salePriceToman: 1_350_000,
          compareAtPriceToman: null,
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

  it('rejects a compare-at price that is not greater than the sale price', async () => {
    const transaction = {
      product: {
        findFirst: jest.fn().mockResolvedValue({
          id: productId,
          salePriceToman: 1_200_000,
          compareAtPriceToman: null,
        }),
        update: jest.fn(),
      },
      productPriceHistory: { create: jest.fn() },
    };
    prisma.$transaction.mockImplementation(
      async (callback: (client: typeof transaction) => Promise<unknown>) => callback(transaction),
    );

    await expect(
      service.setSalePrice(
        productId,
        { salePriceToman: 1_300_000, compareAtPriceToman: 1_300_000 },
        actorUserId,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(transaction.productPriceHistory.create).not.toHaveBeenCalled();
    expect(transaction.product.update).not.toHaveBeenCalled();
  });

  it('returns product prices, plating rates and both histories as one catalog', async () => {
    prisma.product.findMany.mockResolvedValue([{ id: productId, name: 'Product One' }]);
    prisma.platingRate.findMany.mockResolvedValue([{ id: 'rate-1', type: 'GOLD' }]);
    prisma.productPriceHistory.findMany.mockResolvedValue([{ id: 'history-1' }]);
    prisma.platingRateHistory.findMany.mockResolvedValue([{ id: 'history-2' }]);

    await expect(service.getPricingCatalog()).resolves.toEqual({
      products: [{ id: productId, name: 'Product One' }],
      platingRates: [{ id: 'rate-1', type: 'GOLD' }],
      productHistory: [{ id: 'history-1' }],
      platingHistory: [{ id: 'history-2' }],
    });
  });
});
