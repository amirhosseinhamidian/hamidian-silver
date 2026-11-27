import 'reflect-metadata';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { formatTehranDate } from '../src/modules/campaigns/campaign-calendar';
import { CampaignLandingsService } from '../src/modules/campaigns/campaign-landings.service';
import { CampaignsService } from '../src/modules/campaigns/campaigns.service';
import { CatalogService } from '../src/modules/catalog/catalog.service';
import { PublicMediaUrlService } from '../src/modules/catalog/public-media-url.service';
import { GrowthDashboardService } from '../src/modules/growth-attribution/growth-dashboard.service';

const legacySales = 'mar17-legacy-sale';
const legacyMarketing = 'mar17-legacy-marketing';
const legacyFestival = 'mar17-legacy-festival';
const expandedLegacy = 'mar17-write-with-baseline';
const newSales = 'mar17-new-sale';
const newMarketing = 'mar17-new-marketing';
const ownerPhone = '+099000000017';
const orderNumber = 'MAR17-LEGACY-01';
const startsAt = new Date('2026-11-20T08:00:00Z');
const endsAt = new Date('2026-11-20T18:00:00Z');
const paidAt = new Date('2026-11-20T10:00:00Z');
const refundedAt = new Date('2026-11-21T10:00:00Z');
const period = { from: '2026-11-20', to: '2026-11-21' };
const draft = {
  name: 'New compatibility fixture',
  goal: 'Compatibility fixture',
  message: 'Compatibility fixture',
  startsTehran: formatTehranDate(startsAt),
  endsTehran: formatTehranDate(endsAt),
  budgetToman: 500_000,
  allProducts: true,
  productSlugs: [],
  categorySlugs: [],
  bannerEnabled: false,
  bannerPriority: 0,
};

async function seedBaseline(db: PrismaService) {
  await db.$transaction(async (tx) => {
    const owner = await tx.user.create({ data: { phone: ownerPhone } });
    const warehouse = await tx.warehouse.create({
      data: { code: 'MAR17', name: 'Compatibility fixture' },
    });
    const product = await tx.product.create({
      data: {
        slug: 'mar17-fixture-product',
        name: 'Compatibility fixture',
        status: 'ACTIVE',
        salePriceToman: 900_000,
        variants: { create: { sku: 'MAR17-FIXTURE', salePriceToman: 900_000 } },
      },
      include: { variants: true },
    });
    await tx.campaignLinkIdentity.createMany({
      data: [legacySales, legacyMarketing, legacyFestival].map((id) => ({ id, campaign: id })),
    });
    const base = {
      ownerId: owner.id,
      goal: 'Compatibility fixture',
      channel: 'email',
      allProducts: true,
      budgetToman: 300_000,
      startsAt,
      endsAt,
      message: 'Compatibility fixture',
    };
    const sales = await tx.campaign.create({
      data: {
        ...base,
        slug: legacySales,
        name: 'Legacy offer',
        trackingId: legacySales,
        status: 'ENDED',
      },
    });
    const marketing = await tx.campaign.create({
      data: {
        ...base,
        slug: legacyMarketing,
        name: 'Legacy mixed campaign',
        trackingId: legacyMarketing,
        kind: 'MARKETING',
        plannedChannelCostToman: 200_000,
      },
    });
    await tx.campaign.create({
      data: {
        ...base,
        slug: legacyFestival,
        name: 'Legacy festival',
        trackingId: legacyFestival,
        kind: 'FESTIVAL',
      },
    });
    await tx.campaignPromotion.createMany({
      data: [sales.id, marketing.id].map((campaignId) => ({
        campaignId,
        actorUserId: owner.id,
        kind: 'FIXED',
        value: 100_000,
        minSubtotalToman: 0,
        maxDiscountToman: 100_000,
        maxDiscountBps: 5_000,
        priority: 0,
      })),
    });
    await tx.campaignLanding.create({
      data: {
        campaignId: sales.id,
        slug: legacySales,
        title: 'Legacy public landing',
        story: '',
        seoMode: 'RECURRING',
        collectionMode: 'MANUAL',
        manualProductIds: [product.id],
        filters: {},
      },
    });
    await tx.campaignRevision.create({
      data: {
        campaignId: sales.id,
        version: sales.revision,
        action: 'PUBLISH_NOW',
        actorUserId: owner.id,
        snapshot: { title: 'Legacy public landing' },
      },
    });
    const touch = {
      source: 'newsletter',
      medium: 'email',
      campaignId: legacyMarketing,
      campaign: legacyMarketing,
      content: 'compatibility',
      occurredAt: startsAt.toISOString(),
    };
    const order = await tx.order.create({
      data: {
        orderNumber,
        userId: owner.id,
        warehouseId: warehouse.id,
        status: 'PAID',
        createdAt: startsAt,
        paidAt,
        reservationExpiresAt: endsAt,
        merchandiseTotalToman: 900_000,
        discountTotalToman: 100_000,
        grandTotalToman: 800_000,
        items: {
          create: {
            variantId: product.variants[0].id,
            quantity: 1,
            productNameSnapshot: product.name,
            skuSnapshot: product.variants[0].sku,
            unitSalePriceToman: 900_000,
            lineTotalToman: 900_000,
          },
        },
        priceQuote: {
          create: {
            campaignId: sales.id,
            tokenHash: 'a'.repeat(64),
            merchandiseDiscountToman: 100_000,
            shippingDiscountToman: 0,
            snapshot: { version: 1, campaignId: sales.id },
          },
        },
        attribution: {
          create: {
            source: touch.source,
            medium: touch.medium,
            campaignId: touch.campaignId,
            campaign: touch.campaign,
            content: touch.content,
            model: 'LAST_NON_DIRECT',
            policyVersion: 1,
            windowDays: 30,
            attributedAt: startsAt,
            firstTouch: touch,
            lastTouch: touch,
          },
        },
        payment: {
          create: {
            status: 'PARTIALLY_REFUNDED',
            paidAt,
            amountToman: 800_000,
            refundedAmountToman: 100_000,
            refundAllocatedToman: 100_000,
            refunds: {
              create: {
                status: 'CONFIRMED',
                amountToman: 100_000,
                createdAt: paidAt,
                confirmedAt: refundedAt,
                idempotencyKey: orderNumber,
                externalReference: orderNumber,
                confirmedByUserId: owner.id,
              },
            },
          },
        },
        financeSnapshot: {
          create: {
            paidAt,
            merchandiseRevenueToman: 900_000,
            platingRevenueToman: 0,
            discountToman: 100_000,
            shippingChargedToman: 0,
            taxToman: 0,
            customerTotalToman: 800_000,
            supplierCostToman: 300_000,
            grossSalesToman: 900_000,
            netSalesToman: 800_000,
            grossMarginBeforeServiceCostsToman: 500_000,
          },
        },
      },
    });
    const quota = await tx.campaignQuota.create({
      data: { campaignId: sales.id, productId: product.id, limit: 10, manualSold: 1 },
    });
    await tx.campaignQuotaAllocation.create({
      data: { quotaId: quota.id, orderId: order.id, quantity: 1, state: 'CAPTURED' },
    });
    await tx.growthCampaignCost.create({
      data: {
        id: '00000000-0000-4000-8000-000000000017',
        campaignId: legacyMarketing,
        source: touch.source,
        medium: touch.medium,
        day: new Date(period.from),
        amountToman: 200_000,
      },
    });
  });
}

async function legacyFingerprint(db: PrismaService) {
  // Select the columns known to both versions so the digest covers records rather than schema.
  const campaigns = await db.campaign.findMany({
    where: { slug: { in: [legacySales, legacyMarketing, legacyFestival] } },
    select: {
      id: true,
      slug: true,
      name: true,
      kind: true,
      status: true,
      startsAt: true,
      endsAt: true,
      tracking: true,
      budgetToman: true,
      plannedChannelCostToman: true,
      promotion: true,
      landing: true,
      revisions: { orderBy: { version: 'asc' } },
      quotas: {
        orderBy: { productId: 'asc' },
        include: { allocations: { orderBy: { orderId: 'asc' } } },
      },
    },
    orderBy: { slug: 'asc' },
  });
  const order = await db.order.findUniqueOrThrow({
    where: { orderNumber },
    include: {
      priceQuote: true,
      attribution: true,
      financeSnapshot: true,
      items: { orderBy: { id: 'asc' } },
      payment: { include: { refunds: true } },
    },
  });
  const costs = await db.growthCampaignCost.findMany({
    where: { campaignId: legacyMarketing },
    orderBy: { id: 'asc' },
  });
  assert.equal(campaigns.length, 3);
  const serialized = JSON.stringify({ campaigns, order, costs }, (_key, value: unknown) => {
    if (!value || Array.isArray(value) || typeof value !== 'object') return value;
    const entries = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(entries)
        .sort()
        .map((key) => [key, entries[key]]),
    );
  });
  return createHash('sha256').update(serialized).digest('hex');
}

async function assertLegacyReads(
  db: PrismaService,
  campaigns: CampaignsService,
  landings: CampaignLandingsService,
  growth: GrowthDashboardService,
) {
  const sale = await db.campaign.findUniqueOrThrow({
    where: { slug: legacySales },
    select: { id: true },
  });
  const detail = await campaigns.detail(sale.id, 1);
  assert.equal(detail.kind, 'LEGACY');
  assert.equal(detail.trackingId, legacySales);
  assert.equal(detail.budget.committedDiscountToman, 100_000);
  const landing = await landings.publicLanding(legacySales, 1, refundedAt);
  assert.equal(landing.title, 'Legacy public landing');
  assert.equal(landing.active, false);
  const salesReport = await growth.campaignPerformance(legacySales, period);
  assert.equal(salesReport.merchandiseDiscountToman, 100_000);
  if ('offer' in salesReport) {
    assert.deepEqual(salesReport.offer?.quota, {
      products: 1,
      limit: 10,
      manualSold: 1,
      siteSold: 1,
      reserved: 0,
      remaining: 8,
    });
  }
  const marketingReport = await growth.campaignPerformance(legacyMarketing, period);
  assert.equal(marketingReport.totals.confirmedOrders, 1);
  assert.equal(marketingReport.totals.collectedToman, 800_000);
  assert.equal(marketingReport.totals.refundedToman, 100_000);
  assert.equal(marketingReport.totals.netCollectedToman, 700_000);
  assert.equal(marketingReport.totals.recordedSpendToman, 200_000);
}

async function verifyCandidate(
  db: PrismaService,
  campaigns: CampaignsService,
  landings: CampaignLandingsService,
) {
  const owner = await db.user.findUniqueOrThrow({ where: { phone: ownerPhone } });
  const festival = await db.campaign.findUniqueOrThrow({ where: { slug: legacyFestival } });
  const mixed = await db.campaign.findUniqueOrThrow({ where: { slug: legacyMarketing } });
  const legacyRows = await db.campaign.findMany({
    where: { slug: { in: [legacySales, legacyMarketing, legacyFestival, expandedLegacy] } },
    select: {
      managementPurpose: true,
      marketingDestinationPath: true,
      relatedSalesCampaignId: true,
      relatedFestivalId: true,
    },
  });
  assert.equal(legacyRows.length, 4);
  for (const fields of legacyRows)
    assert.ok(Object.values(fields).every((value) => value === null));
  for (const view of ['sales', 'marketing'] as const) {
    const list = await campaigns.list({ view, q: mixed.name });
    assert.ok(
      list.items.some(({ id }) => id === mixed.id),
      `Historical mixed campaign missing from ${view}`,
    );
  }
  const offer = await campaigns.create(
    { ...draft, slug: newSales, managementPurpose: 'SALES' },
    owner.id,
  );
  const marketing = await campaigns.create(
    {
      ...draft,
      slug: newMarketing,
      kind: 'MARKETING',
      channel: 'email',
      marketing: {
        destinationPath: '/products',
        relatedFestivalId: festival.id,
        relatedSalesCampaignId: offer.id,
      },
    },
    owner.id,
  );
  assert.equal((await campaigns.detail(offer.id, 1)).managementPurpose, 'SALES');
  assert.deepEqual((await campaigns.detail(marketing.id, 1)).marketing, {
    destinationPath: '/products',
    relatedFestivalId: festival.id,
    relatedSalesCampaignId: offer.id,
  });
  await assert.rejects(landings.editor(offer.id), /Sales offers do not have a landing/);
}

async function verifyLegacyReadOnly(
  db: PrismaService,
  campaigns: CampaignsService,
  landings: CampaignLandingsService,
) {
  const offer = await db.campaign.findUniqueOrThrow({
    where: { slug: newSales },
    select: { id: true },
  });
  const marketing = await db.campaign.findUniqueOrThrow({
    where: { slug: newMarketing },
    select: { id: true },
  });
  const oldOffer = await campaigns.detail(offer.id, 1);
  assert.equal(oldOffer.kind, 'LEGACY');
  assert.equal('managementPurpose' in oldOffer, false);
  assert.equal('marketing' in (await campaigns.detail(marketing.id, 1)), false);
  assert.equal((await landings.editor(offer.id)).landing, null);
  process.stdout.write(
    'Expected rollback limitation: the baseline exposes the landing editor for the new sales offer and omits new marketing settings.\n',
  );
}

async function main() {
  const [mode, evidenceFile] = process.argv.slice(2);
  assert.ok(
    evidenceFile &&
      (mode === 'seed' ||
        mode === 'expanded-legacy' ||
        mode === 'candidate' ||
        mode === 'rollback'),
    'Use the MAR-17 local wrapper.',
  );
  const endpoint = new URL(process.env.DATABASE_URL ?? '');
  assert.equal(endpoint.protocol, 'postgresql:');
  assert.equal(endpoint.hostname, '127.0.0.1');
  assert.equal(endpoint.pathname, '/hamidian_mar17_compat');
  assert.equal(endpoint.username, 'hamidian');

  const config = new ConfigService();
  const db = new PrismaService(config);
  const media = new PublicMediaUrlService(config);
  const landings = new CampaignLandingsService(db, new CatalogService(db, media), media);
  const campaigns = new CampaignsService(db, media, landings);
  const growth = new GrowthDashboardService(db);
  try {
    if (mode === 'seed') {
      const fields = await db.$queryRaw<{ name: string }[]>`
        SELECT column_name AS name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'campaigns' AND column_name = 'managementPurpose'
      `;
      assert.equal(fields.length, 0, 'The baseline fixture must predate the campaign migrations.');
      await seedBaseline(db);
    }
    await assertLegacyReads(db, campaigns, landings, growth);
    if (mode === 'expanded-legacy') {
      const owner = await db.user.findUniqueOrThrow({ where: { phone: ownerPhone } });
      const legacy = await campaigns.create(
        {
          ...draft,
          slug: expandedLegacy,
          channel: 'email',
          trackingId: expandedLegacy,
          trackingLabel: expandedLegacy,
        },
        owner.id,
      );
      assert.equal(legacy.kind, 'LEGACY');
    }
    if (mode === 'candidate') await verifyCandidate(db, campaigns, landings);
    if (mode === 'rollback') await verifyLegacyReadOnly(db, campaigns, landings);
    const digest = await legacyFingerprint(db);
    if (mode === 'seed') await writeFile(evidenceFile, digest, { flag: 'wx' });
    else
      assert.equal(
        digest,
        await readFile(evidenceFile, 'utf8'),
        'Legacy campaign and order evidence changed.',
      );
    process.stdout.write(
      `${mode}: legacy campaign, landing, order, payment and attribution evidence ${digest}\n`,
    );
  } finally {
    await db.$disconnect();
  }
}

void main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : 'Compatibility check failed.'}\n`,
  );
  process.exitCode = 1;
});
