import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { OrdersService } from './orders.service';

describe('OrdersService customer projection security', () => {
  const userId = '10000000-0000-4000-8000-000000000001';
  const orderId = '20000000-0000-4000-8000-000000000001';

  const prisma = {
    order: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
  };

  let service: OrdersService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new OrdersService(prisma as unknown as PrismaService);
  });

  it('scopes the customer order list and excludes procurement fields', async () => {
    prisma.order.findMany.mockResolvedValue([]);

    await service.listMyOrders(userId, {});

    const query = prisma.order.findMany.mock.calls[0]?.[0];
    expect(query.where).toEqual(
      expect.objectContaining({
        userId,
      }),
    );
    expect(query.select).not.toHaveProperty('userId');
    expect(query.select).not.toHaveProperty('warehouseId');

    const itemSelect = query.select.items.select;
    expect(itemSelect).not.toHaveProperty('unitSupplierPriceToman');
    expect(itemSelect).not.toHaveProperty('supplierIdSnapshot');
    expect(itemSelect).not.toHaveProperty('supplierNameSnapshot');
    expect(itemSelect).not.toHaveProperty('returnAllocatedQuantity');
  });

  it('scopes customer order detail and hides staff audit metadata', async () => {
    prisma.order.findFirst.mockResolvedValue({
      id: orderId,
    });

    await service.getMyOrder(userId, orderId);

    const query = prisma.order.findFirst.mock.calls[0]?.[0];
    expect(query.where).toEqual({
      id: orderId,
      userId,
    });
    expect(query.select).not.toHaveProperty('userId');
    expect(query.select).not.toHaveProperty('warehouseId');
    expect(query.select.statusHistory.select).toEqual({
      fromStatus: true,
      toStatus: true,
      createdAt: true,
    });
    expect(query.select.statusHistory.select).not.toHaveProperty('actorUserId');
    expect(query.select.statusHistory.select).not.toHaveProperty('reason');
  });
});
