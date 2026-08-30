import { BadRequestException, ConflictException } from '@nestjs/common';
import { OrderStatus, PlatingType, ProductStatus } from '../../generated/prisma/enums';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { OrdersService } from './orders.service';

describe('OrdersService', () => {
  const userId = '10000000-0000-4000-8000-000000000001';
  const warehouseId = '20000000-0000-4000-8000-000000000001';
  const variantId = '30000000-0000-4000-8000-000000000001';
  const inventoryId = '40000000-0000-4000-8000-000000000001';

  const prisma = {
    order: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  let service: OrdersService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new OrdersService(prisma as unknown as PrismaService);
  });

  it('creates an order with price snapshots and reserves inventory', async () => {
    const transaction = {
      warehouse: {
        findFirst: jest.fn().mockResolvedValue({ id: warehouseId }),
      },
      productVariant: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: variantId,
            sku: 'RING-52',
            name: 'Size 52',
            weightGrams: {
              toString: () => '4.250',
            },
            platingEligible: true,
            size: {
              label: '52',
            },
            product: {
              name: 'Silver Ring',
              status: ProductStatus.ACTIVE,
              salePriceToman: 1_350_000,
              suppliers: [
                {
                  supplierId: '50000000-0000-4000-8000-000000000001',
                  supplierPriceToman: 1_000_000,
                  supplier: {
                    name: 'Supplier One',
                  },
                },
              ],
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
          },
        ]),
      },
      order: {
        create: jest.fn().mockResolvedValue({
          id: '60000000-0000-4000-8000-000000000001',
        }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: '60000000-0000-4000-8000-000000000001',
          status: OrderStatus.PENDING_PAYMENT,
        }),
      },
      orderStatusHistory: {
        create: jest.fn().mockResolvedValue({}),
      },
      inventory: {
        findUnique: jest.fn().mockResolvedValue({
          id: inventoryId,
          onHand: 10,
          reserved: 2,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      inventoryMovement: {
        create: jest.fn().mockResolvedValue({}),
      },
    };

    prisma.$transaction.mockImplementation(
      async (callback: (client: typeof transaction) => Promise<unknown>) => callback(transaction),
    );

    await service.createOrder(userId, {
      shippingAddress: {
        recipientName: 'Test Customer',
        phone: '09123456789',
        province: 'Tehran',
        city: 'Tehran',
        addressLine: 'Test address',
        postalCode: '1234567890',
      },
      items: [
        {
          variantId,
          quantity: 2,
          platingType: PlatingType.GOLD,
        },
      ],
    });

    expect(transaction.order.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId,
        warehouseId,
        status: OrderStatus.PENDING_PAYMENT,
        merchandiseTotalToman: 2_700_000,
        platingTotalToman: 425_000,
        grandTotalToman: 3_125_000,
        items: {
          create: [
            expect.objectContaining({
              variantId,
              quantity: 2,
              unitSalePriceToman: 1_350_000,
              unitSupplierPriceToman: 1_000_000,
              platingType: PlatingType.GOLD,
              platingRateToman: 50_000,
              unitPlatingPriceToman: 212_500,
              lineTotalToman: 3_125_000,
            }),
          ],
        },
      }),
      select: {
        id: true,
      },
    });

    expect(transaction.inventory.updateMany).toHaveBeenCalledWith({
      where: {
        id: inventoryId,
        onHand: 10,
        reserved: 2,
      },
      data: {
        reserved: 4,
      },
    });

    expect(transaction.inventoryMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        inventoryId,
        actorUserId: userId,
        reservedDelta: 2,
        onHandAfter: 10,
        reservedAfter: 4,
        referenceType: 'ORDER',
      }),
    });
  });

  it('rejects an order when inventory is insufficient', async () => {
    const transaction = {
      warehouse: {
        findFirst: jest.fn().mockResolvedValue({ id: warehouseId }),
      },
      productVariant: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: variantId,
            sku: 'PENDANT-1',
            name: null,
            weightGrams: null,
            platingEligible: false,
            size: null,
            product: {
              name: 'Silver Pendant',
              salePriceToman: 900_000,
              suppliers: [],
            },
            platingOptions: [],
          },
        ]),
      },
      order: {
        create: jest.fn().mockResolvedValue({
          id: '60000000-0000-4000-8000-000000000001',
        }),
      },
      orderStatusHistory: {
        create: jest.fn().mockResolvedValue({}),
      },
      inventory: {
        findUnique: jest.fn().mockResolvedValue({
          id: inventoryId,
          onHand: 2,
          reserved: 2,
        }),
        updateMany: jest.fn(),
      },
      inventoryMovement: {
        create: jest.fn(),
      },
    };

    prisma.$transaction.mockImplementation(
      async (callback: (client: typeof transaction) => Promise<unknown>) => callback(transaction),
    );

    await expect(
      service.createOrder(userId, {
        shippingAddress: {
          recipientName: 'Test Customer',
          phone: '09123456789',
          province: 'Tehran',
          city: 'Tehran',
          addressLine: 'Test address',
          postalCode: '1234567890',
        },
        items: [
          {
            variantId,
            quantity: 1,
          },
        ],
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('does not allow staff status changes to mark a pending order as paid', async () => {
    const transaction = {
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: '60000000-0000-4000-8000-000000000001',
          status: OrderStatus.PENDING_PAYMENT,
          deliveredAt: null,
        }),
        update: jest.fn(),
      },
      orderStatusHistory: {
        create: jest.fn(),
      },
    };

    prisma.$transaction.mockImplementation(
      async (callback: (client: typeof transaction) => Promise<unknown>) => callback(transaction),
    );

    await expect(
      service.updateStatus(
        '60000000-0000-4000-8000-000000000001',
        {
          status: OrderStatus.PAID,
        },
        userId,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(transaction.order.update).not.toHaveBeenCalled();
  });

  it('releases reserved inventory when a pending order is cancelled', async () => {
    const orderId = '60000000-0000-4000-8000-000000000001';
    const transaction = {
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: orderId,
          warehouseId,
          status: OrderStatus.PENDING_PAYMENT,
          items: [
            {
              variantId,
              quantity: 2,
            },
          ],
        }),
        update: jest.fn().mockResolvedValue({
          id: orderId,
          status: OrderStatus.CANCELLED,
        }),
      },
      inventory: {
        findUnique: jest.fn().mockResolvedValue({
          id: inventoryId,
          onHand: 10,
          reserved: 4,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      inventoryMovement: {
        create: jest.fn().mockResolvedValue({}),
      },
      orderStatusHistory: {
        create: jest.fn().mockResolvedValue({}),
      },
    };

    prisma.$transaction.mockImplementation(
      async (callback: (client: typeof transaction) => Promise<unknown>) => callback(transaction),
    );

    await service.cancelOrder(
      orderId,
      {
        reason: 'Manager cancellation',
      },
      userId,
    );

    expect(transaction.inventory.updateMany).toHaveBeenCalledWith({
      where: {
        id: inventoryId,
        onHand: 10,
        reserved: 4,
      },
      data: {
        reserved: 2,
      },
    });

    expect(transaction.order.update).toHaveBeenCalledWith({
      where: {
        id: orderId,
      },
      data: {
        status: OrderStatus.CANCELLED,
        cancelledAt: expect.any(Date),
      },
    });
  });
});
