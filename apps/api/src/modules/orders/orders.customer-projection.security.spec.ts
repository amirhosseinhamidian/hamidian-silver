import type { PrismaService } from '../../infrastructure/database/prisma.service';
import type { PublicMediaUrlService } from '../catalog/public-media-url.service';
import { OrdersService } from './orders.service';

describe('OrdersService customer projection security', () => {
  const userId = '10000000-0000-4000-8000-000000000001';
  const orderId = '20000000-0000-4000-8000-000000000001';

  const prisma = {
    order: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
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

  it('returns public product media and tracking data with customer orders', async () => {
    const mediaUrl = {
      resolve: jest.fn().mockReturnValue('https://media.example/products/ring.webp'),
    };
    service = new OrdersService(
      prisma as unknown as PrismaService,
      mediaUrl as unknown as PublicMediaUrlService,
    );
    prisma.order.findMany.mockResolvedValue([
      {
        id: orderId,
        shipment: { trackingCode: 'POST-123' },
        items: [
          {
            id: '30000000-0000-4000-8000-000000000001',
            productNameSnapshot: 'انگشتر نقره',
            variant: {
              product: {
                slug: 'silver-ring',
                media: [
                  {
                    altText: 'نمای انگشتر',
                    media: {
                      storageKey: 'products/ring.webp',
                      mimeType: 'image/webp',
                      altText: null,
                      width: 800,
                      height: 800,
                    },
                  },
                ],
              },
            },
          },
        ],
      },
    ]);

    const [order] = await service.listMyOrders(userId, {});

    expect(order).toEqual(
      expect.objectContaining({
        trackingCode: 'POST-123',
        items: [
          expect.objectContaining({
            productSlug: 'silver-ring',
            primaryMedia: expect.objectContaining({
              url: 'https://media.example/products/ring.webp',
              mimeType: 'image/webp',
            }),
          }),
        ],
      }),
    );
    expect(order.items[0]).not.toHaveProperty('variant');
  });

  it('counts every order owned by the authenticated customer', async () => {
    prisma.order.count.mockResolvedValue(72);

    await expect(service.countMyOrders(userId)).resolves.toEqual({ count: 72 });
    expect(prisma.order.count).toHaveBeenCalledWith({ where: { userId } });
  });
});
