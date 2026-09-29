import { ConfigService } from '@nestjs/config';

import {
  AdminMessageChannel,
  NotificationOutboxStatus,
  PaymentStatus,
} from '../../generated/prisma/enums';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import type { PublicMediaUrlService } from '../catalog/public-media-url.service';
import type { AdminMessageSender } from './admin-message.sender';
import { AdminOrderNotificationWorker } from './admin-order-notification.worker';

describe('AdminOrderNotificationWorker', () => {
  it('sends the first ordered product primary image with the admin message', async () => {
    const delivery = {
      id: 'delivery-1',
      orderId: 'order-1',
      channel: AdminMessageChannel.TELEGRAM,
      chatIdSnapshot: '123456789',
      status: NotificationOutboxStatus.PENDING,
      attempts: 0,
      claimedAt: null,
    };
    const prisma = {
      adminOrderNotificationDelivery: {
        findMany: jest.fn().mockResolvedValue([delivery]),
        updateMany: jest
          .fn()
          .mockResolvedValueOnce({ count: 1 })
          .mockResolvedValueOnce({ count: 1 }),
      },
      order: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'order-1',
          orderNumber: 'HS-1',
          createdAt: new Date('2026-09-28T12:00:00.000Z'),
          merchandiseTotalToman: 1_000_000,
          platingTotalToman: 0,
          discountTotalToman: 0,
          shippingTotalToman: 50_000,
          taxTotalToman: 0,
          grandTotalToman: 1_050_000,
          payment: { status: PaymentStatus.PAID },
          customerNote: null,
          shippingCarrierNameSnapshot: 'پست',
          user: { phone: '09121234567', firstName: 'امیر', lastName: 'حمیدیان' },
          shippingAddress: null,
          items: [
            {
              productNameSnapshot: 'انگشتر نقره',
              variantNameSnapshot: null,
              skuSnapshot: 'SKU-1',
              sizeLabelSnapshot: null,
              platingType: null,
              quantity: 1,
              lineTotalToman: 1_000_000,
              variant: {
                product: {
                  media: [{ media: { storageKey: 'catalog/2026/09/ring.webp' } }],
                },
              },
            },
          ],
        }),
      },
    };
    const sender = { send: jest.fn().mockResolvedValue(undefined) };
    const mediaUrl = {
      resolve: jest.fn().mockReturnValue('https://media.hamidian.shop/catalog/2026/09/ring.webp'),
    };
    const config = {
      get: jest.fn((key: string, fallback?: unknown) =>
        key === 'ADMIN_APP_ORIGIN' ? 'https://admin.hamidian.shop' : fallback,
      ),
    };
    const worker = new AdminOrderNotificationWorker(
      prisma as unknown as PrismaService,
      sender as unknown as AdminMessageSender,
      mediaUrl as unknown as PublicMediaUrlService,
      config as unknown as ConfigService,
    );

    await worker.dispatchPending();

    expect(mediaUrl.resolve).toHaveBeenCalledWith('catalog/2026/09/ring.webp');
    expect(sender.send).toHaveBeenCalledWith(
      AdminMessageChannel.TELEGRAM,
      '123456789',
      expect.stringContaining('HS-1'),
      'https://media.hamidian.shop/catalog/2026/09/ring.webp',
    );
  });
});
