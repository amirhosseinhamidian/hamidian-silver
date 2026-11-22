import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { formatTehranDate } from '../src/modules/campaigns/campaign-calendar';
import type { CampaignAction } from '../src/modules/campaigns/campaign-lifecycle';
import { CampaignsService } from '../src/modules/campaigns/campaigns.service';
import { PublicMediaUrlService } from '../src/modules/catalog/public-media-url.service';
import { PromotionsService } from '../src/modules/promotions/promotions.service';

it('previews a scoped campaign, protects its budget and stops the scheduled discount', async () => {
  const config = new ConfigService();
  const db = new PrismaService(config);
  const campaigns = new CampaignsService(db, new PublicMediaUrlService(config));
  const promotions = new PromotionsService(db);
  const trackingId = `ops-${randomUUID()}`;
  const phone = `+0${BigInt(`0x${randomUUID().replaceAll('-', '').slice(0, 12)}`)}`;
  const start = new Date(Math.floor(Date.now() / 60_000) * 60_000);
  const end = new Date(start.valueOf() + 60 * 60_000);

  try {
    const owner = await db.user.create({ data: { phone } });
    const product = await db.product.create({
      data: { slug: trackingId, name: 'محصول عملیات کمپین', status: 'ACTIVE' },
    });
    const draft = {
      slug: trackingId,
      trackingId,
      trackingLabel: trackingId,
      name: 'کمپین مناسبتی',
      message: 'مشاهدهٔ محصولات',
      goal: 'تست عملیات کمپین',
      channel: 'email',
      budgetToman: 3_000,
      plannedChannelCostToman: 1_000,
      audience: 'FIRST_PURCHASE' as const,
      allProducts: false,
      productSlugs: [product.slug],
      categorySlugs: [],
      startsTehran: formatTehranDate(start),
      endsTehran: formatTehranDate(end),
      bannerEnabled: false,
      bannerPriority: 0,
    };
    await expect(
      campaigns.create({ ...draft, plannedChannelCostToman: 3_001 }, owner.id),
    ).rejects.toThrow('exceeds the campaign budget');
    const { id } = await campaigns.create(draft, owner.id);
    const move = (action: CampaignAction, expectedRevision: number) =>
      campaigns.transition(id, { action, expectedRevision, requestId: randomUUID() }, owner.id);
    await expect(move('APPROVE', 1)).rejects.toThrow('selected audience');
    await expect(campaigns.selectProducts(product.slug)).resolves.toMatchObject({
      items: [{ slug: product.slug, name: product.name }],
    });

    const rule = {
      kind: 'FIXED' as const,
      value: 2_500,
      minSubtotalToman: 4_000,
      maxDiscountToman: 2_500,
      maxDiscountBps: 5_000,
      priority: 20,
      bundleProductSlugs: [],
      couponCode: trackingId.slice(0, 12).toUpperCase(),
      maxUses: 2,
      expectedVersion: 0,
    };
    await promotions.save(id, rule, owner.id);
    const simulation = {
      expectedRevision: 2,
      items: [{ slug: product.slug, quantity: 2, unitSalePriceToman: 4_000 }],
      hasPaidOrder: false,
      shippingToman: 500,
    };
    await expect(campaigns.simulate(id, { ...simulation, expectedRevision: 1 })).rejects.toThrow(
      'Reload',
    );
    await expect(campaigns.simulate(id, simulation)).resolves.toMatchObject({
      eligibleSubtotalToman: 8_000,
      merchandiseDiscountToman: 2_000,
      shippingDiscountToman: 0,
      payableToman: 6_500,
      reason: null,
    });
    await expect(
      campaigns.simulate(id, { ...simulation, hasPaidOrder: true }),
    ).resolves.toMatchObject({ merchandiseDiscountToman: 0 });
    await expect(campaigns.detail(id, 1)).resolves.toMatchObject({
      revision: 2,
      budget: { remainingDiscountToman: 2_000, usedOrders: 0, remainingUses: 2, blockers: [] },
      history: [
        { action: 'PROMOTION_EDIT', actorUserId: owner.id, snapshot: { hasCoupon: true } },
        { action: 'CREATE' },
      ],
    });

    await campaigns.update(id, { ...draft, budgetToman: 1_000, expectedRevision: 2 }, owner.id);
    await expect(move('APPROVE', 3)).rejects.toThrow('No discount budget remains');
    await campaigns.update(id, { ...draft, expectedRevision: 3 }, owner.id);
    await expect(move('APPROVE', 4)).resolves.toMatchObject({ status: 'APPROVED', revision: 5 });
    await expect(move('SCHEDULE', 5)).resolves.toMatchObject({ status: 'SCHEDULED', revision: 6 });
    await campaigns.advance(start);
    const lines = [
      { productId: product.id, categoryIds: [], quantity: 2, unitSalePriceToman: 4_000 },
    ];
    const quote = (userId?: string) =>
      db.$transaction((tx) => promotions.apply(tx, lines, 500, start, rule.couponCode, userId));
    await expect(quote()).resolves.toBeNull();
    await expect(quote(owner.id)).resolves.toMatchObject({
      campaignId: id,
      merchandiseDiscountToman: 2_000,
    });
    await expect(move('PAUSE', 7)).resolves.toMatchObject({ status: 'PAUSED', revision: 8 });
    await expect(quote(owner.id)).resolves.toBeNull();
    await expect(move('RESUME', 8)).resolves.toMatchObject({ status: 'SCHEDULED', revision: 9 });
    await campaigns.advance(start);
    await expect(quote(owner.id)).resolves.toMatchObject({ campaignId: id });
  } finally {
    try {
      await db.$transaction([
        db.campaignPromotion.deleteMany({ where: { campaign: { trackingId } } }),
        db.campaignRevision.deleteMany({ where: { campaign: { trackingId } } }),
        db.campaign.deleteMany({ where: { trackingId } }),
        db.campaignLinkIdentity.deleteMany({ where: { id: trackingId } }),
        db.product.deleteMany({ where: { slug: trackingId } }),
        db.user.deleteMany({ where: { phone } }),
      ]);
    } finally {
      await db.$disconnect();
    }
  }
}, 25_000);
