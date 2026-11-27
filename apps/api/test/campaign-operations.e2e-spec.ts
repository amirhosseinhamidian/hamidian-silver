import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { formatTehranDate } from '../src/modules/campaigns/campaign-calendar';
import { CampaignLandingsService } from '../src/modules/campaigns/campaign-landings.service';
import { CampaignQuotasService } from '../src/modules/campaigns/campaign-quotas.service';
import type { CampaignAction } from '../src/modules/campaigns/campaign-lifecycle';
import { CampaignsService } from '../src/modules/campaigns/campaigns.service';
import type { CreateCampaignDto } from '../src/modules/campaigns/dto/campaign.dto';
import { CatalogService } from '../src/modules/catalog/catalog.service';
import { PublicMediaUrlService } from '../src/modules/catalog/public-media-url.service';
import { PromotionsService } from '../src/modules/promotions/promotions.service';
import { buildCampaignUrl } from '../src/modules/growth-attribution/campaign-links.service';

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

it('stores a marketing destination and links without adding sales rules', async () => {
  const config = new ConfigService();
  const db = new PrismaService(config);
  const campaigns = new CampaignsService(db, new PublicMediaUrlService(config));
  const promotions = new PromotionsService(db);
  const key = `mar07-${randomUUID()}`;
  const quotas = new CampaignQuotasService(db, promotions);
  const phone = `+0${BigInt(`0x${randomUUID().replaceAll('-', '').slice(0, 12)}`)}`;
  const start = new Date(Math.floor(Date.now() / 60_000) * 60_000);
  const end = new Date(start.valueOf() + 60 * 60_000);

  try {
    const owner = await db.user.create({ data: { phone } });
    const product = await db.product.create({
      data: { slug: key, name: 'مقصد فعال', status: 'ACTIVE' },
    });
    const base = {
      name: 'فعالیت بازاریابی',
      goal: 'معرفی فروشگاه',
      message: 'معرفی محصول',
      startsTehran: formatTehranDate(start),
      endsTehran: formatTehranDate(end),
      budgetToman: 12_000,
      allProducts: true,
      productSlugs: [],
      categorySlugs: [],
      bannerEnabled: false,
      bannerPriority: 0,
    };
    const festival = await campaigns.create(
      { ...base, kind: 'FESTIVAL', slug: `${key}-fest` },
      owner.id,
    );
    const sales = await campaigns.create(
      { ...base, managementPurpose: 'SALES', slug: `${key}-sales` },
      owner.id,
    );
    const input = {
      ...base,
      kind: 'MARKETING',
      slug: key,
      channel: 'organic',
      marketing: {
        destinationPath: `/products/${product.slug}`,
        relatedFestivalId: festival.id,
        relatedSalesCampaignId: sales.id,
      },
    } satisfies CreateCampaignDto;
    await expect(
      campaigns.create(
        { ...input, marketing: { destinationPath: '/products/missing-destination' } },
        owner.id,
      ),
    ).rejects.toThrow('available campaign destination');
    await expect(
      campaigns.create(
        { ...input, marketing: { destinationPath: '/products?page=999999' } },
        owner.id,
      ),
    ).rejects.toThrow('without a page number');
    await expect(
      campaigns.create(
        { ...input, marketing: { ...input.marketing, relatedFestivalId: sales.id } },
        owner.id,
      ),
    ).rejects.toThrow('available festival');
    const { id } = await campaigns.create(input, owner.id);
    const detail = await campaigns.detail(id, 1);
    expect(detail).toMatchObject({
      marketing: input.marketing,
      plannedChannelCostToman: base.budgetToman,
      budget: { discountBudgetToman: 0 },
    });
    const link = buildCampaignUrl('https://hamidian.shop', {
      destination: detail.marketing!.destinationPath,
      medium: detail.channel,
      source: 'google',
      campaignId: detail.trackingId,
      campaign: detail.trackingLabel,
    });
    expect(new URL(link.url).searchParams.get('utm_id')).toBe(detail.trackingId);
    expect(new URL(link.url).searchParams.get('utm_medium')).toBe('organic');
    await expect(
      quotas.save(
        id,
        { slug: product.slug, limit: 0, manualSold: 0, expectedRevision: 0 },
        owner.id,
      ),
    ).rejects.toThrow('separate advertising budget');
    await expect(
      promotions.save(
        id,
        {
          kind: 'FIXED',
          value: 100,
          minSubtotalToman: 0,
          maxDiscountToman: 100,
          maxDiscountBps: 1_000,
          priority: 0,
          bundleProductSlugs: [],
          expectedVersion: 0,
        },
        owner.id,
      ),
    ).rejects.toThrow('separate advertising budget');
    await expect(
      campaigns.update(
        id,
        {
          ...base,
          channel: 'organic',
          expectedRevision: 1,
          marketing: { ...input.marketing, relatedSalesCampaignId: null },
        },
        owner.id,
      ),
    ).resolves.toMatchObject({ revision: 2 });
    expect(await campaigns.detail(id, 1)).toMatchObject({
      marketing: { relatedFestivalId: festival.id, relatedSalesCampaignId: null },
      trackingId: detail.trackingId,
    });
    await db.product.update({ where: { id: product.id }, data: { status: 'DRAFT' } });
    await expect(
      campaigns.transition(
        id,
        {
          action: 'APPROVE',
          expectedRevision: 2,
          requestId: randomUUID(),
        },
        owner.id,
      ),
    ).rejects.toThrow('available campaign destination');
  } finally {
    try {
      const where = { slug: { in: [key, `${key}-fest`, `${key}-sales`] } };
      const ids = await db.campaign.findMany({ where, select: { trackingId: true } });
      await db.$transaction([
        db.campaignRevision.deleteMany({ where: { campaign: where } }),
        db.campaign.deleteMany({ where }),
        db.campaignLinkIdentity.deleteMany({
          where: { id: { in: ids.map(({ trackingId }) => trackingId) } },
        }),
        db.product.deleteMany({ where: { slug: key } }),
        db.user.deleteMany({ where: { phone } }),
      ]);
    } finally {
      await db.$disconnect();
    }
  }
}, 25_000);

it('schedules a standalone offer and applies its rule through the existing promotion engine', async () => {
  const config = new ConfigService();
  const db = new PrismaService(config);
  const media = new PublicMediaUrlService(config);
  const landings = new CampaignLandingsService(db, new CatalogService(db, media), media);
  const campaigns = new CampaignsService(db, media, landings);
  const promotions = new PromotionsService(db);
  const slug = `sales-offer-${randomUUID()}`;
  const phone = `+0${BigInt(`0x${randomUUID().replaceAll('-', '').slice(0, 12)}`)}`;
  const start = new Date(Math.floor(Date.now() / 60_000) * 60_000);
  const end = new Date(start.valueOf() + 60 * 60_000);
  let trackingId: string | undefined;

  try {
    const owner = await db.user.create({ data: { phone } });
    const product = await db.product.create({
      data: { slug, name: 'محصول پیشنهاد فروش', status: 'ACTIVE' },
    });
    const draft = {
      name: 'پیشنهاد مستقل',
      goal: 'تست فروش',
      message: 'پیشنهاد مستقل',
      budgetToman: 4_000,
      allProducts: false,
      productSlugs: [product.slug],
      categorySlugs: [],
      startsTehran: formatTehranDate(start),
      endsTehran: formatTehranDate(end),
      bannerEnabled: false,
      bannerPriority: 0,
    };
    const input = { ...draft, slug, managementPurpose: 'SALES' } satisfies CreateCampaignDto;
    await expect(campaigns.create({ ...input, bannerEnabled: true }, owner.id)).rejects.toThrow(
      'campaign banners',
    );
    const { id, kind, managementPurpose } = await campaigns.create(input, owner.id);
    trackingId = (await campaigns.detail(id, 1)).trackingId;
    expect(trackingId).toMatch(/^sales-/);
    expect({ kind, managementPurpose }).toEqual({ kind: 'LEGACY', managementPurpose: 'SALES' });
    await expect(landings.editor(id)).rejects.toThrow('Sales offers do not have a landing');
    await expect(
      campaigns.update(id, { ...draft, expectedRevision: 1, kind: 'FESTIVAL' }, owner.id),
    ).rejects.toThrow('legacy draft');
    const move = (action: CampaignAction, expectedRevision: number) =>
      campaigns.transition(id, { action, expectedRevision, requestId: randomUUID() }, owner.id);
    await expect(move('APPROVE', 1)).rejects.toThrow('Configure a promotion for this sales offer');
    await expect(
      campaigns.update(id, { ...draft, name: 'پیشنهاد ویرایش‌شده', expectedRevision: 1 }, owner.id),
    ).resolves.toMatchObject({ revision: 2, managementPurpose: 'SALES' });

    const couponCode = `SO-${slug.slice(-12).toUpperCase()}`;
    await promotions.save(
      id,
      {
        kind: 'PERCENT',
        value: 1_000,
        minSubtotalToman: 0,
        maxDiscountToman: 500,
        maxDiscountBps: 1_000,
        priority: 0,
        bundleProductSlugs: [],
        couponCode,
        maxUses: 2,
        expectedVersion: 0,
      },
      owner.id,
    );
    await expect(move('APPROVE', 3)).resolves.toMatchObject({ status: 'APPROVED', revision: 4 });
    await expect(move('SCHEDULE', 4)).resolves.toMatchObject({ status: 'SCHEDULED', revision: 5 });
    await campaigns.advance(start);
    const lines = [
      { productId: product.id, categoryIds: [], quantity: 1, unitSalePriceToman: 4_000 },
    ];
    const quote = () =>
      db.$transaction((tx) => promotions.apply(tx, lines, 0, start, couponCode, owner.id));
    await expect(quote()).resolves.toMatchObject({ campaignId: id, merchandiseDiscountToman: 400 });
    expect((await campaigns.publicBanner(start)).banner?.campaignId).not.toBe(id);
    // Simulate a landing written by an older API that did not know the management purpose.
    await db.campaignLanding.create({
      data: {
        campaignId: id,
        slug,
        title: 'پیشنهاد فروش',
        story: '',
        seoMode: 'RECURRING',
        collectionMode: 'MANUAL',
        manualProductIds: [product.id],
        filters: {},
      },
    });
    await expect(landings.publicLanding(slug, 1, start)).rejects.toThrow(
      'Campaign landing not found',
    );
    expect((await landings.sitemap(start)).entries.some((entry) => entry.slug === slug)).toBe(
      false,
    );
    await expect(move('PAUSE', 6)).resolves.toMatchObject({ status: 'PAUSED', revision: 7 });
    await expect(quote()).resolves.toBeNull();
  } finally {
    try {
      await db.$transaction([
        db.campaignPromotion.deleteMany({ where: { campaign: { slug } } }),
        db.campaignLanding.deleteMany({ where: { campaign: { slug } } }),
        db.campaignRevision.deleteMany({ where: { campaign: { slug } } }),
        db.campaign.deleteMany({ where: { slug } }),
        ...(trackingId ? [db.campaignLinkIdentity.deleteMany({ where: { id: trackingId } })] : []),
        db.product.deleteMany({ where: { slug } }),
        db.user.deleteMany({ where: { phone } }),
      ]);
    } finally {
      await db.$disconnect();
    }
  }
}, 25_000);
