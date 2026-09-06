import { ErrorCode } from '../../common/errors/error-codes';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { StockNotificationsService } from './stock-notifications.service';

describe('StockNotificationsService', () => {
  const userId = '10000000-0000-4000-8000-000000000001';
  const productId = '20000000-0000-4000-8000-000000000001';
  const variantId = '30000000-0000-4000-8000-000000000001';
  const prisma = {
    product: {
      findFirst: jest.fn(),
    },
    stockNotificationSubscription: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  };
  const service = new StockNotificationsService(prisma as unknown as PrismaService);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.product.findFirst.mockResolvedValue({
      id: productId,
      variants: [
        {
          id: variantId,
          inventories: [{ onHand: 0, reserved: 0 }],
        },
      ],
    });
    prisma.stockNotificationSubscription.findFirst.mockResolvedValue(null);
    prisma.stockNotificationSubscription.create.mockResolvedValue({});
  });

  it('creates a variant-specific subscription for an unavailable variant', async () => {
    await expect(service.subscribe(userId, { productId, variantId })).resolves.toEqual({
      subscribed: true,
      target: 'VARIANT',
    });

    expect(prisma.stockNotificationSubscription.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId,
        productId,
        variantId,
      }),
    });
  });

  it('returns the existing active subscription without creating a duplicate', async () => {
    prisma.stockNotificationSubscription.findFirst.mockResolvedValue({ id: 'existing' });

    await expect(service.subscribe(userId, { productId })).resolves.toEqual({
      subscribed: true,
      target: 'PRODUCT',
    });
    expect(prisma.stockNotificationSubscription.create).not.toHaveBeenCalled();
  });

  it('rejects a target that is already available', async () => {
    prisma.product.findFirst.mockResolvedValue({
      id: productId,
      variants: [
        {
          id: variantId,
          inventories: [{ onHand: 2, reserved: 0 }],
        },
      ],
    });

    await expect(service.subscribe(userId, { productId, variantId })).rejects.toMatchObject({
      code: ErrorCode.STOCK_ALREADY_AVAILABLE,
    });
  });
});
