import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import {
  attributionPolicy,
  buildOrderAttribution,
} from '../src/modules/growth-attribution/attribution';
import { CampaignLinksService } from '../src/modules/growth-attribution/campaign-links.service';

it('reuses a campaign identity and persists only normalized attribution on an order', async () => {
  const config = new ConfigService({ STOREFRONT_PUBLIC_ORIGIN: 'https://test.hamidian.shop' });
  const prisma = new PrismaService(config);
  const rollback = new Error('Roll back the attribution fixture');
  try {
    await prisma.$transaction(
      async (transaction) => {
        const suffix = randomUUID();
        const identity = `winter-${suffix}`;
        const links = new CampaignLinksService(config, transaction as unknown as PrismaService);
        const input = {
          destination: '/products?page=2',
          campaignId: identity,
          campaign: identity,
          source: 'Newsletter',
          medium: 'email',
        };
        await expect(links.create(input)).resolves.toMatchObject({ campaignId: identity });
        await expect(links.create({ ...input, source: 'Telegram' })).resolves.toMatchObject({
          campaignId: identity,
        });
        await expect(links.create({ ...input, campaign: 'Conflicting Sale' })).rejects.toThrow(
          'already assigned',
        );
        await expect(links.create({ ...input, campaignId: `other-${suffix}` })).rejects.toThrow(
          'already assigned',
        );

        const owner = await transaction.user.create({
          data: { phone: `+0${suffix.replace(/\D/g, '').slice(0, 16)}` },
        });
        const warehouse = await transaction.warehouse.create({
          data: { code: `attribution-${suffix}`, name: 'Attribution fixture' },
        });
        const now = new Date();
        const snapshot = await buildOrderAttribution(
          transaction,
          {
            version: 1,
            touches: [
              {
                source: input.source,
                medium: input.medium,
                campaign: input.campaign,
                campaignId: identity,
                occurredAt: now.toISOString(),
                phone: owner.phone,
              },
            ],
          },
          attributionPolicy(config),
          now.valueOf(),
        );
        if (!snapshot) throw new Error('Expected eligible attribution');
        const order = await transaction.order.create({
          data: {
            orderNumber: `TEST-${suffix.slice(0, 16)}`,
            userId: owner.id,
            warehouseId: warehouse.id,
            merchandiseTotalToman: 1000,
            grandTotalToman: 1000,
            reservationExpiresAt: new Date(now.valueOf() + 60_000),
            attribution: { create: snapshot },
          },
          select: { id: true, attribution: true },
        });
        expect(order.attribution).toMatchObject({
          orderId: order.id,
          campaignId: identity,
          source: 'newsletter',
          medium: 'email',
        });
        expect(order.attribution?.firstTouch).not.toHaveProperty('phone');
        await transaction.order.delete({ where: { id: order.id } });
        await expect(
          transaction.orderAttribution.count({ where: { orderId: order.id } }),
        ).resolves.toBe(0);
        throw rollback;
      },
      { timeout: 15000 },
    );
  } catch (error) {
    if (error !== rollback) throw error;
  } finally {
    await prisma.$disconnect();
  }
}, 20000);
