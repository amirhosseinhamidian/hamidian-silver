import { OrderStatus, ProductStatus } from '../../generated/prisma/enums';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { OrdersService } from './orders.service';

describe('OrdersService saved address checkout', () => {
  const userId = '10000000-0000-4000-8000-000000000001';
  const addressId = '20000000-0000-4000-8000-000000000001';
  const warehouseId = '30000000-0000-4000-8000-000000000001';
  const variantId = '40000000-0000-4000-8000-000000000001';
  const inventoryId = '50000000-0000-4000-8000-000000000001';
  const orderId = '60000000-0000-4000-8000-000000000001';

  const prisma = {
    $transaction: jest.fn(),
  };

  let service: OrdersService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new OrdersService(prisma as unknown as PrismaService);
  });

  it('copies a saved user address into the immutable order-address snapshot', async () => {
    const transaction = {
      userAddress: {
        findFirst: jest.fn().mockResolvedValue({
          recipientName: 'Saved Recipient',
          phone: '09123456789',
          province: 'Tehran',
          city: 'Tehran',
          addressLine: 'Saved address line',
          postalCode: '1234567890',
        }),
      },
      warehouse: {
        findFirst: jest.fn().mockResolvedValue({
          id: warehouseId,
        }),
      },
      productVariant: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: variantId,
            sku: 'SKU-1',
            name: null,
            weightGrams: null,
            platingEligible: false,
            size: null,
            product: {
              name: 'Silver Item',
              status: ProductStatus.ACTIVE,
              salePriceToman: 1_000_000,
              suppliers: [],
            },
            platingOptions: [],
          },
        ]),
      },
      order: {
        create: jest.fn().mockResolvedValue({
          id: orderId,
        }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: orderId,
          status: OrderStatus.PENDING_PAYMENT,
        }),
      },
      orderStatusHistory: {
        create: jest.fn().mockResolvedValue({}),
      },
      inventory: {
        findUnique: jest.fn().mockResolvedValue({
          id: inventoryId,
          onHand: 5,
          reserved: 0,
        }),
        updateMany: jest.fn().mockResolvedValue({
          count: 1,
        }),
      },
      inventoryMovement: {
        create: jest.fn().mockResolvedValue({}),
      },
    };

    prisma.$transaction.mockImplementation(
      async (callback: (client: typeof transaction) => Promise<unknown>) => callback(transaction),
    );

    await service.createOrder(userId, {
      userAddressId: addressId,
      items: [
        {
          variantId,
          quantity: 1,
        },
      ],
    });

    expect(transaction.userAddress.findFirst).toHaveBeenCalledWith({
      where: {
        id: addressId,
        userId,
        deletedAt: null,
      },
      select: {
        recipientName: true,
        phone: true,
        province: true,
        city: true,
        addressLine: true,
        postalCode: true,
      },
    });

    expect(transaction.order.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        shippingAddress: {
          create: {
            recipientName: 'Saved Recipient',
            phone: '09123456789',
            province: 'Tehran',
            city: 'Tehran',
            addressLine: 'Saved address line',
            postalCode: '1234567890',
          },
        },
      }),
      select: {
        id: true,
      },
    });
  });
});
