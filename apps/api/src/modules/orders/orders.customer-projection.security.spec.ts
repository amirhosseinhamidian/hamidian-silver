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
    expect(query.select.payment.select.attempts.select).not.toHaveProperty('receiptData');
    expect(query.select.payment.select.attempts.select).not.toHaveProperty('failureMessage');
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
      reason: true,
      createdAt: true,
    });
    expect(query.select.statusHistory.select).not.toHaveProperty('actorUserId');
    expect(query.select.payment.select.attempts.select).toEqual(
      expect.objectContaining({
        failureCode: true,
        failureMessage: true,
      }),
    );
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
        returnAuthorizedAt: new Date('2026-09-06T13:00:00.000Z'),
        shipment: {
          provider: 'postex',
          providerServiceCode: 'IR_POST|EXPRESS',
          providerServiceName: 'پست پیشتاز',
          carrierNameSnapshot: 'پست ایران',
          carrierTrackingUrlSnapshot: 'https://tracking.post.ir/',
          carrierLogoSnapshot: null,
          carrierPresentationSnapshottedAt: new Date('2026-09-06T08:00:00.000Z'),
          trackingCode: 'POST-123',
        },
        items: [
          {
            id: '30000000-0000-4000-8000-000000000001',
            productNameSnapshot: 'انگشتر نقره',
            quantity: 2,
            returnAllocatedQuantity: 1,
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
        shippingMethodName: 'پست ایران',
        shippingTrackingUrl: 'https://tracking.post.ir/',
        shippingCarrierLogoUrl: null,
        returnAuthorized: true,
        items: [
          expect.objectContaining({
            productSlug: 'silver-ring',
            returnableQuantity: 1,
            primaryMedia: expect.objectContaining({
              url: 'https://media.example/products/ring.webp',
              mimeType: 'image/webp',
            }),
          }),
        ],
      }),
    );
    expect(order.items[0]).not.toHaveProperty('variant');
    expect(order.items[0]).not.toHaveProperty('returnAllocatedQuantity');
    expect(order).not.toHaveProperty('returnAuthorizedAt');
  });

  it('returns customer-facing rejection and cancellation reasons without exposing history notes', async () => {
    prisma.order.findFirst.mockResolvedValue({
      id: orderId,
      status: 'CANCELLED',
      customerNote: 'لطفاً بسته به نگهبانی تحویل داده شود.',
      returnAuthorizedAt: null,
      shippingCarrierNameSnapshot: null,
      shippingCarrierTrackingUrlSnapshot: null,
      shippingPricingModeSnapshot: null,
      shippingCarrierLogoSnapshot: null,
      shipment: null,
      payment: {
        status: 'PENDING',
        attempts: [
          {
            provider: 'card_to_card',
            failureCode: 'CARD_TO_CARD_RECEIPT_REJECTED',
            failureMessage: 'مبلغ واریزی صحیح نیست.',
            receiptOriginalName: 'receipt.jpg',
            receiptUploadedAt: new Date('2026-09-21T10:00:00.000Z'),
          },
        ],
      },
      items: [],
      statusHistory: [
        {
          fromStatus: null,
          toStatus: 'PENDING_PAYMENT',
          reason: 'Internal creation note',
          createdAt: new Date('2026-09-21T09:00:00.000Z'),
        },
        {
          fromStatus: 'PENDING_PAYMENT',
          toStatus: 'CANCELLED',
          reason: 'کالا دیگر موجود نیست.',
          createdAt: new Date('2026-09-21T10:05:00.000Z'),
        },
      ],
    });

    const order = await service.getMyOrder(userId, orderId);

    expect(order.customerNote).toBe('لطفاً بسته به نگهبانی تحویل داده شود.');

    expect(order.cancellationReason).toBe('کالا دیگر موجود نیست.');
    expect(order.payment?.rejectionReason).toBe('مبلغ واریزی صحیح نیست.');
    expect(order.statusHistory).toEqual([
      {
        fromStatus: null,
        toStatus: 'PENDING_PAYMENT',
        createdAt: new Date('2026-09-21T09:00:00.000Z'),
      },
      {
        fromStatus: 'PENDING_PAYMENT',
        toStatus: 'CANCELLED',
        createdAt: new Date('2026-09-21T10:05:00.000Z'),
      },
    ]);
  });

  it('counts every order owned by the authenticated customer', async () => {
    prisma.order.count.mockResolvedValue(72);

    await expect(service.countMyOrders(userId)).resolves.toEqual({ count: 72 });
    expect(prisma.order.count).toHaveBeenCalledWith({ where: { userId } });
  });
});
