import type { ConfigService } from '@nestjs/config';

import {
  AdminMessageChannel,
  NotificationOutboxStatus,
  PaymentStatus,
} from '../../generated/prisma/enums';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import type { PublicMediaUrlService } from '../catalog/public-media-url.service';
import type { AdminMessageSender } from './admin-message.sender';
import { AdminOrderNotificationWorker } from './admin-order-notification.worker';

const IMAGE_ERROR =
  'TELEGRAM relay rejected the message: TELEGRAM_REJECTED: Bad Request: failed to get HTTP URL content.';
const IMAGE_URL = 'https://media.hamidian.shop/catalog/2026/10/product.png';

describe('AdminOrderNotificationWorker Telegram image fallback', () => {
  beforeEach(() => jest.clearAllMocks());

  it('sends the product image on the first attempt and marks the delivery sent', async () => {
    const { worker, sender, prisma } = createWorker();

    await worker.dispatchPending();

    expect(sender.send).toHaveBeenCalledWith(
      AdminMessageChannel.TELEGRAM,
      '123456789',
      expect.stringContaining('HS-TEST'),
      { imageUrl: IMAGE_URL },
    );
    expect(prisma.adminOrderNotificationDelivery.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: NotificationOutboxStatus.SENT,
          claimedAt: null,
          lastError: null,
        }),
      }),
    );
  });

  it.each([0, 1, 2])(
    'keeps sending the image after image-fetch failure on prior attempt %i',
    async (attempts) => {
      const { worker, sender } = createWorker({
        attempts,
        status: attempts === 0 ? NotificationOutboxStatus.PENDING : NotificationOutboxStatus.FAILED,
        lastError: attempts === 0 ? null : IMAGE_ERROR,
      });
      sender.send.mockRejectedValueOnce(new Error(IMAGE_ERROR));

      await worker.dispatchPending();

      expect(sender.send).toHaveBeenCalledWith(
        AdminMessageChannel.TELEGRAM,
        '123456789',
        expect.any(String),
        { imageUrl: IMAGE_URL },
      );
    },
  );

  it('sends the complete message without an image on the fourth attempt', async () => {
    const { worker, sender } = createWorker({
      attempts: 3,
      status: NotificationOutboxStatus.FAILED,
      lastError: IMAGE_ERROR,
    });

    await worker.dispatchPending();

    expect(sender.send).toHaveBeenCalledWith(
      AdminMessageChannel.TELEGRAM,
      '123456789',
      expect.stringMatching(/اقلام سفارش:[\s\S]*مبلغ نهایی:[\s\S]*جزئیات سفارش/),
      {},
    );
  });

  it('marks a successful text fallback sent', async () => {
    const { worker, prisma } = createWorker({
      attempts: 3,
      status: NotificationOutboxStatus.FAILED,
      lastError: IMAGE_ERROR,
    });

    await worker.dispatchPending();

    expect(prisma.adminOrderNotificationDelivery.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: NotificationOutboxStatus.SENT,
          processedAt: expect.any(Date),
          lastError: null,
        }),
      }),
    );
  });

  it('persists text-fallback mode after a failed text send and retries without an image', async () => {
    const first = createWorker({
      attempts: 3,
      status: NotificationOutboxStatus.FAILED,
      lastError: IMAGE_ERROR,
    });
    first.sender.send.mockRejectedValueOnce(new Error('TELEGRAM relay request timed out'));

    await first.worker.dispatchPending();

    const failureUpdate =
      first.prisma.adminOrderNotificationDelivery.updateMany.mock.calls.at(-1)?.[0];
    expect(failureUpdate.data).toEqual(
      expect.objectContaining({
        status: NotificationOutboxStatus.FAILED,
        lastError: '[telegram-text-fallback] TELEGRAM relay request timed out',
      }),
    );

    const restarted = createWorker({
      attempts: 4,
      status: NotificationOutboxStatus.FAILED,
      lastError: failureUpdate.data.lastError,
    });
    await restarted.worker.dispatchPending();

    expect(restarted.sender.send).toHaveBeenCalledWith(
      AdminMessageChannel.TELEGRAM,
      '123456789',
      expect.any(String),
      {},
    );
  });

  it.each([4, 5, 6, 7])(
    'continues text-only fallback on persisted attempt %i',
    async (attempts) => {
      const { worker, sender } = createWorker({
        attempts,
        status: NotificationOutboxStatus.FAILED,
        lastError: '[telegram-text-fallback] previous text delivery failed',
      });

      await worker.dispatchPending();

      expect(sender.send).toHaveBeenCalledWith(
        AdminMessageChannel.TELEGRAM,
        '123456789',
        expect.any(String),
        {},
      );
    },
  );

  it('does not activate fallback for unrelated Telegram API errors', async () => {
    const { worker, sender } = createWorker({
      attempts: 3,
      status: NotificationOutboxStatus.FAILED,
      lastError:
        'TELEGRAM relay rejected the message: TELEGRAM_REJECTED: Forbidden: bot was blocked by the user.',
    });

    await worker.dispatchPending();

    expect(sender.send).toHaveBeenCalledWith(
      AdminMessageChannel.TELEGRAM,
      '123456789',
      expect.any(String),
      { imageUrl: IMAGE_URL },
    );
  });

  it('keeps fallback decisions independent for each recipient delivery', async () => {
    const deliveries = [
      delivery({ id: 'delivery-a', chatIdSnapshot: '111', attempts: 3, lastError: IMAGE_ERROR }),
      delivery({ id: 'delivery-b', chatIdSnapshot: '222', attempts: 0, lastError: null }),
    ];
    const { worker, sender } = createWorker({}, { deliveries });

    await worker.dispatchPending();

    expect(sender.send).toHaveBeenNthCalledWith(
      1,
      AdminMessageChannel.TELEGRAM,
      '111',
      expect.any(String),
      {},
    );
    expect(sender.send).toHaveBeenNthCalledWith(
      2,
      AdminMessageChannel.TELEGRAM,
      '222',
      expect.any(String),
      { imageUrl: IMAGE_URL },
    );
  });

  it('sends text normally when the ordered product has no image', async () => {
    const { worker, sender } = createWorker({}, { withImage: false });

    await worker.dispatchPending();

    expect(sender.send).toHaveBeenCalledWith(
      AdminMessageChannel.TELEGRAM,
      '123456789',
      expect.any(String),
      {},
    );
  });
});

function createWorker(
  overrides: Record<string, unknown> = {},
  options: { deliveries?: ReturnType<typeof delivery>[]; withImage?: boolean } = {},
) {
  const deliveries = options.deliveries ?? [delivery(overrides)];
  const prisma = {
    adminOrderNotificationDelivery: {
      findMany: jest.fn().mockResolvedValue(deliveries),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    order: {
      findUniqueOrThrow: jest.fn().mockResolvedValue(order(options.withImage ?? true)),
    },
  };
  const sender = { send: jest.fn().mockResolvedValue(undefined) };
  const publicMediaUrl = {
    resolve: jest.fn((storageKey: string) => `https://media.hamidian.shop/${storageKey}`),
  };
  const config = {
    get: jest.fn((key: string, fallback?: unknown) =>
      key === 'ADMIN_APP_ORIGIN' ? 'https://admin.hamidian.shop' : fallback,
    ),
  };
  const worker = new AdminOrderNotificationWorker(
    prisma as unknown as PrismaService,
    sender as unknown as AdminMessageSender,
    publicMediaUrl as unknown as PublicMediaUrlService,
    config as unknown as ConfigService,
  );

  return { worker, prisma, sender, publicMediaUrl };
}

function delivery(overrides: Record<string, unknown> = {}) {
  return {
    id: 'delivery-1',
    orderId: 'order-1',
    channel: AdminMessageChannel.TELEGRAM,
    chatIdSnapshot: '123456789',
    status: NotificationOutboxStatus.FAILED,
    attempts: 0,
    nextAttemptAt: new Date(0),
    claimedAt: null,
    lastError: null,
    createdAt: new Date(0),
    ...overrides,
  };
}

function order(withImage: boolean) {
  return {
    id: 'order-1',
    orderNumber: 'HS-TEST',
    createdAt: new Date('2026-10-11T12:00:00.000Z'),
    merchandiseTotalToman: 1_900_000,
    platingTotalToman: 0,
    discountTotalToman: 0,
    shippingTotalToman: 100_000,
    taxTotalToman: 0,
    grandTotalToman: 2_000_000,
    payment: { status: PaymentStatus.PAID },
    customerNote: 'سفارش تست',
    shippingCarrierNameSnapshot: 'تیپاکس',
    user: { phone: '+989120000000', firstName: 'امیرحسین', lastName: 'حمیدیان' },
    shippingAddress: {
      recipientName: 'امیرحسین حمیدیان',
      phone: '+989120000000',
      province: 'تهران',
      city: 'تهران',
      addressLine: 'آدرس تست',
      postalCode: '1234567890',
    },
    items: [
      {
        productNameSnapshot: 'انگشتر نقره',
        variantNameSnapshot: null,
        skuSnapshot: 'SKU-1',
        sizeLabelSnapshot: '۵۴',
        platingType: null,
        quantity: 1,
        lineTotalToman: 1_900_000,
        variant: {
          product: {
            media: withImage ? [{ media: { storageKey: 'catalog/2026/10/product.png' } }] : [],
          },
        },
      },
    ],
  };
}
