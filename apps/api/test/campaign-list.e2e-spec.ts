import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import type { Prisma } from '../src/generated/prisma/client';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { formatTehranDate } from '../src/modules/campaigns/campaign-calendar';
import { selectCampaignProducts } from '../src/modules/campaigns/campaign-selection';
import { CampaignsService } from '../src/modules/campaigns/campaigns.service';
import { PublicMediaUrlService } from '../src/modules/catalog/public-media-url.service';

it('filters campaigns before pagination and preserves mixed and legacy records', async () => {
  const config = new ConfigService();
  const prisma = new PrismaService(config);
  const rollback = new Error('Roll back the campaign list fixtures');

  try {
    await prisma.$transaction(
      async (db) => {
        const prefix = `list-${randomUUID()}`;
        const phone = `+0${BigInt(`0x${randomUUID().replaceAll('-', '').slice(0, 12)}`)}`;
        const owner = await db.user.create({ data: { phone } });
        const start = Date.UTC(2099, 0, 1);
        function campaign(
          label: string,
          order: number,
          kind: Prisma.CampaignCreateManyInput['kind'] = 'LEGACY',
          plannedChannelCostToman?: number,
        ) {
          const slug = `${prefix}-${label}`;
          return {
            id: randomUUID(),
            slug,
            trackingId: slug,
            kind,
            plannedChannelCostToman,
            ownerId: owner.id,
            name: label,
            goal: 'Test campaign list views',
            message: 'Test campaign list',
            channel: 'email',
            allProducts: true,
            budgetToman: 5_000,
            startsAt: new Date(start + order * 60_000),
            endsAt: new Date(start + 3_600_000),
          } satisfies Prisma.CampaignCreateManyInput;
        }

        const sales = Array.from({ length: 25 }, (_, i) => campaign(`sale-${i}`, i));
        const mixed = campaign('mixed', 25, 'MARKETING');
        const festival = campaign('festival', 26, 'FESTIVAL');
        const planned = campaign('planned', 27, 'LEGACY', 1_000);
        const recorded = campaign('recorded', 28);
        const legacy = campaign('legacy', 29, 'LEGACY', 0);
        const offer = {
          ...campaign('draft-offer', 30),
          channel: 'sales',
          managementPurpose: 'SALES' as const,
        };
        const rows = [...sales, mixed, festival, planned, recorded, legacy, offer];
        await db.campaignLinkIdentity.createMany({
          data: rows.map(({ trackingId }) => ({ id: trackingId, campaign: trackingId })),
        });
        await db.campaign.createMany({ data: rows });
        await db.campaignPromotion.createMany({
          data: [...sales, mixed, festival].map(
            ({ id }): Prisma.CampaignPromotionCreateManyInput => ({
              campaignId: id,
              actorUserId: owner.id,
              kind: 'PERCENT',
              value: 500,
              minSubtotalToman: 0,
              maxDiscountToman: 5_000,
              maxDiscountBps: 500,
              priority: 0,
            }),
          ),
        });
        await db.growthCampaignCost.create({
          data: {
            id: randomUUID(),
            campaignId: recorded.trackingId,
            source: 'test',
            medium: 'email',
            day: new Date(start),
            amountToman: 500,
          },
        });

        const service = new CampaignsService(
          db as unknown as PrismaService,
          new PublicMediaUrlService(config),
        );
        const salesFirst = await service.list({ view: 'sales' });
        expect(salesFirst.hasMore).toBe(true);
        expect(salesFirst.items.map(({ id }) => id)).toEqual(
          [offer, mixed, ...sales.slice(2).reverse()].map(({ id }) => id),
        );
        expect(salesFirst.items[0]).toMatchObject({
          id: offer.id,
          managementPurpose: 'SALES',
          salesDetails: {
            allProducts: true,
            quotaProducts: 0,
            discountBudgetToman: 5_000,
          },
        });
        expect(
          (await service.list({ page: 2, view: 'sales' })).items.slice(0, 2).map(({ id }) => id),
        ).toEqual([sales[1].id, sales[0].id]);
        expect((await service.list({ view: 'festivals' })).items[0]?.id).toBe(festival.id);
        expect(
          (await service.list({ view: 'marketing' })).items.slice(0, 3).map(({ id }) => id),
        ).toEqual([recorded, planned, mixed].map(({ id }) => id));
        expect((await service.list()).items.slice(0, 2).map(({ id }) => id)).toEqual([
          offer.id,
          legacy.id,
        ]);
        const filtered = await service.list({
          view: 'sales',
          salesKind: 'existing',
          q: 'sale-',
          status: 'DRAFT',
          sort: 'oldest',
          fromTehran: formatTehranDate(new Date(start)),
          toTehran: formatTehranDate(new Date(start + 120_000)),
        });
        expect(filtered.items.map(({ id }) => id)).toEqual([sales[0].id, sales[1].id]);
        await expect(
          service.list({ view: 'sales', salesKind: 'offers', q: 'draft-offer', status: 'ACTIVE' }),
        ).resolves.toMatchObject({ items: [] });
        throw rollback;
      },
      { timeout: 15_000 },
    );
  } catch (error) {
    if (error !== rollback) throw error;
  } finally {
    await prisma.$disconnect();
  }
}, 20_000);

it('pages through more than 500 matching products and restores selections across pages', async () => {
  const config = new ConfigService();
  const prisma = new PrismaService(config);
  const mediaUrls = new PublicMediaUrlService(config);
  const rollback = new Error('Roll back the campaign product fixtures');

  try {
    await prisma.$transaction(
      async (db) => {
        const prefix = `picker-${randomUUID()}`;
        const slug = (index: number) => `${prefix}-${String(index).padStart(3, '0')}`;
        const products = Array.from({ length: 505 }, (_, index) => ({
          slug: slug(index),
          name: slug(index),
          status: 'ACTIVE' as const,
          salePriceToman: 50_000,
        }));
        const draft = slug(505);
        await db.product.createMany({
          data: [...products, { slug: draft, name: draft, status: 'DRAFT' }],
        });

        const first = await selectCampaignProducts(db, mediaUrls, { q: prefix });
        const second = await selectCampaignProducts(db, mediaUrls, { q: prefix, page: 2 });
        const last = await selectCampaignProducts(db, mediaUrls, { q: prefix, page: 43 });
        expect(first.items.map((item) => item.slug)).toEqual(
          products.slice(0, 12).map((p) => p.slug),
        );
        expect(first.hasMore).toBe(true);
        expect(second.items.map((item) => item.slug)).toEqual(
          products.slice(12, 24).map((p) => p.slug),
        );
        expect(last).toMatchObject({
          page: 43,
          hasMore: false,
          items: [{ slug: slug(504), defaultPriceToman: 50_000 }],
        });

        const restored = await selectCampaignProducts(db, mediaUrls, {
          selected: [slug(504), draft, slug(0), slug(504)],
        });
        expect(restored.items.map((item) => item.slug)).toEqual([slug(0), slug(504)]);
        expect(restored.hasMore).toBe(false);
        throw rollback;
      },
      { timeout: 15_000 },
    );
  } catch (error) {
    if (error !== rollback) throw error;
  } finally {
    await prisma.$disconnect();
  }
}, 20_000);
