import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { formatTehranDate } from '../src/modules/campaigns/campaign-calendar';
import type { CampaignAction } from '../src/modules/campaigns/campaign-lifecycle';
import { resolveHumanAuditEvent } from '../src/modules/audit/audit-event';
import { CampaignLandingsService } from '../src/modules/campaigns/campaign-landings.service';
import { CampaignsService } from '../src/modules/campaigns/campaigns.service';
import type { CampaignLandingDraftDto } from '../src/modules/campaigns/dto/campaign-landing.dto';
import { CatalogService } from '../src/modules/catalog/catalog.service';
import { PublicMediaUrlService } from '../src/modules/catalog/public-media-url.service';

it('locks transitions across transactions, reuses tracking and expires the banner before the worker catches up', async () => {
  const config = new ConfigService();
  const db = new PrismaService(config);
  const campaigns = new CampaignsService(db, new PublicMediaUrlService(config));
  const tracking = `cm01-${randomUUID()}`;
  const phone = `+0${BigInt(`0x${randomUUID().replaceAll('-', '').slice(0, 12)}`)}`;
  const start = new Date(Math.ceil(Date.now() / 60_000) * 60_000 + 120_000);
  const end = new Date(start.valueOf() + 60_000);
  try {
    const owner = await db.user.create({ data: { phone } });
    const reviewer = await db.user.create({ data: { phone: `${phone}1` } });
    await db.campaignLinkIdentity.create({ data: { id: tracking, campaign: tracking } });
    const product = await db.product.create({
      data: { slug: tracking, name: 'انگشتر', status: 'ACTIVE' },
    });
    const draft = {
      slug: tracking,
      trackingId: tracking,
      trackingLabel: tracking,
      name: 'کمپین آزمایشی',
      message: 'مشاهدهٔ محصولات',
      goal: 'معرفی محصولات',
      channel: 'email',
      budgetToman: 1000,
      allProducts: false,
      productSlugs: [product.slug],
      categorySlugs: [],
      startsTehran: formatTehranDate(start),
      endsTehran: formatTehranDate(end),
      bannerEnabled: true,
      bannerPriority: 100,
      ctaLabel: 'دیدن محصولات',
      ctaPath: '/products',
    };
    await expect(
      campaigns.create({ ...draft, ctaPath: '//example.com' }, owner.id),
    ).rejects.toThrow('public storefront path');
    await expect(
      campaigns.create({ ...draft, productSlugs: ['missing'] }, owner.id),
    ).rejects.toThrow('scope are unavailable');
    const created = await campaigns.create(draft, owner.id);
    expect(created).toMatchObject({
      status: 'DRAFT',
      revision: 1,
      ownerId: owner.id,
      startsAt: start.toISOString(),
    });
    const move = (action: CampaignAction, expectedRevision: number, requestId = randomUUID()) =>
      campaigns.transition(created.id, { action, expectedRevision, requestId }, reviewer.id);

    await expect(move('SCHEDULE', 1)).rejects.toThrow('unavailable');
    await db.product.update({ where: { id: product.id }, data: { status: 'DRAFT' } });
    await expect(move('APPROVE', 1)).rejects.toThrow('scope are unavailable');
    await db.product.update({ where: { id: product.id }, data: { status: 'ACTIVE' } });
    const approval = randomUUID();
    const approved = await Promise.all([
      move('APPROVE', 1, approval),
      move('APPROVE', 1, approval),
    ]);
    expect(approved.map(({ status, revision }) => [status, revision])).toEqual([
      ['APPROVED', 2],
      ['APPROVED', 2],
    ]);
    await expect(
      campaigns.update(created.id, { ...draft, expectedRevision: 1 }, owner.id),
    ).rejects.toThrow('Reload');
    await expect(move('SCHEDULE', 2)).resolves.toMatchObject({ status: 'SCHEDULED', revision: 3 });
    await expect(move('APPROVE', 1, approval)).resolves.toMatchObject({
      status: 'SCHEDULED',
      revision: 3,
    });
    await expect(campaigns.publicBanner(start)).resolves.toEqual({ banner: null });

    const concurrent = await Promise.all([campaigns.advance(start), campaigns.advance(start)]);
    expect(concurrent.reduce((sum, count) => sum + count, 0)).toBe(1);
    await expect(campaigns.publicBanner(start)).resolves.toEqual({
      banner: {
        campaignId: created.id,
        name: draft.name,
        message: draft.message,
        endsAt: end.toISOString(),
        media: null,
        ctaPath: '/products',
        ctaLabel: draft.ctaLabel,
      },
    });
    const paused = await move('PAUSE', 4);
    expect(paused).toMatchObject({ status: 'PAUSED', revision: 5 });
    expect(
      resolveHumanAuditEvent(
        paused,
        {
          method: 'POST',
          resource: 'campaigns',
          action: 'POST /campaigns/:id/transitions',
        },
        'SUCCESS',
      ),
    ).toMatchObject({
      operationType: 'STATUS_CHANGE',
      changes: [{ field: 'status', before: 'ACTIVE', after: 'PAUSED' }],
    });
    await expect(campaigns.publicBanner(start)).resolves.toEqual({ banner: null });
    await expect(move('RESUME', 5)).resolves.toMatchObject({ status: 'SCHEDULED', revision: 6 });
    await expect(campaigns.advance(start)).resolves.toBe(1);
    await expect(campaigns.publicBanner(new Date(end.valueOf() - 1))).resolves.toMatchObject({
      banner: { name: draft.name },
    });
    await expect(campaigns.publicBanner(end)).resolves.toEqual({ banner: null });
    await expect(campaigns.advance(end)).resolves.toBe(1);
    await expect(campaigns.advance(end)).resolves.toBe(0);
    const detail = await campaigns.detail(created.id, 1);
    expect(detail).toMatchObject({ status: 'ENDED', revision: 8, productSlugs: [product.slug] });
    expect(
      detail.history.map(({ version, action, actorUserId }) => [version, action, actorUserId]),
    ).toEqual([
      [8, 'EXPIRE', null],
      [7, 'PUBLISH', null],
      [6, 'RESUME', reviewer.id],
      [5, 'PAUSE', reviewer.id],
      [4, 'PUBLISH', null],
      [3, 'SCHEDULE', reviewer.id],
      [2, 'APPROVE', reviewer.id],
      [1, 'CREATE', owner.id],
    ]);
    expect(detail.history.at(-1)?.snapshot).toMatchObject({
      budgetToman: 1000,
      productIds: [product.id],
      status: 'DRAFT',
    });
  } finally {
    try {
      await db.$transaction([
        db.campaignRevision.deleteMany({ where: { campaign: { trackingId: tracking } } }),
        db.campaign.deleteMany({ where: { trackingId: tracking } }),
        db.campaignLinkIdentity.deleteMany({ where: { id: tracking } }),
        db.product.deleteMany({ where: { slug: tracking } }),
        db.user.deleteMany({ where: { phone: { in: [phone, `${phone}1`] } } }),
      ]);
    } finally {
      await db.$disconnect();
    }
  }
}, 25_000);

it('separates festival publication and archival from existing campaign tracking', async () => {
  const config = new ConfigService();
  const db = new PrismaService(config);
  const media = new PublicMediaUrlService(config);
  const landings = new CampaignLandingsService(db, new CatalogService(db, media), media);
  const campaigns = new CampaignsService(db, media, landings);
  const slug = `fest-${randomUUID()}`;
  const phone = `+0${BigInt(`0x${randomUUID().replaceAll('-', '').slice(0, 12)}`)}`;
  const start = new Date(Math.floor(Date.now() / 60_000) * 60_000 - 60_000);
  const end = new Date(start.valueOf() + 20 * 60_000);
  const tomorrow = 24 * 60 * 60_000;
  try {
    const owner = await db.user.create({ data: { phone } });
    const primary =
      (await db.warehouse.findFirst({
        where: { isDefault: true, isActive: true, deletedAt: null },
      })) ??
      (await db.warehouse.create({
        data: { code: slug, name: 'Festival fixture', isDefault: true },
      }));
    const product = await db.product.create({
      data: {
        slug,
        name: 'انگشتر',
        status: 'ACTIVE',
        salePriceToman: 500_000,
        variants: {
          create: { sku: slug, inventories: { create: { warehouseId: primary.id, onHand: 3 } } },
        },
      },
    });
    const draft = {
      name: 'جشنوارهٔ تست',
      goal: 'فروش مناسبتی',
      message: 'مشاهدهٔ محصولات',
      allProducts: false,
      productSlugs: [slug],
      categorySlugs: [],
      startsTehran: formatTehranDate(new Date(start.valueOf() + tomorrow)),
      endsTehran: formatTehranDate(new Date(end.valueOf() + tomorrow)),
      budgetToman: 1000,
      bannerEnabled: true,
      bannerPriority: 0,
    };
    const landing = {
      slug,
      seoMode: 'RECURRING',
      title: draft.name,
      story: draft.goal,
      collectionMode: 'MANUAL',
      filters: { minimumQuantity: 1 },
      manualProductSlugs: [slug],
      placements: [
        { slot: 'NAVIGATION', priority: 50, appearance: { display: { title: 'منوی منتشرشده' } } },
      ],
    } satisfies CampaignLandingDraftDto;
    const marketTracking = `${slug}-market`;
    await expect(
      campaigns.create({ ...draft, slug: marketTracking, kind: 'MARKETING' }, owner.id),
    ).rejects.toThrow('tracking labels');
    const marketing = await campaigns.create(
      {
        ...draft,
        slug: marketTracking,
        kind: 'MARKETING',
        channel: 'email',
        trackingId: marketTracking,
        trackingLabel: marketTracking,
      },
      owner.id,
    );
    await expect(
      landings.save(marketing.id, { ...landing, expectedRevision: 1 }, owner.id),
    ).rejects.toThrow('Marketing campaigns do not have a landing');

    const legacyTracking = `${slug}-legacy`;
    const legacy = await campaigns.create(
      {
        ...draft,
        slug: legacyTracking,
        channel: 'email',
        trackingId: legacyTracking,
        trackingLabel: legacyTracking,
        plannedChannelCostToman: 250,
      },
      owner.id,
    );
    expect(legacy.kind).toBe('LEGACY');
    await expect(
      campaigns.update(
        legacy.id,
        { ...draft, kind: 'FESTIVAL', expectedRevision: 1, plannedChannelCostToman: null },
        owner.id,
      ),
    ).resolves.toMatchObject({ kind: 'FESTIVAL', revision: 2 });
    await expect(campaigns.detail(legacy.id, 1)).resolves.toMatchObject({
      channel: 'email',
      trackingId: legacyTracking,
      plannedChannelCostToman: 250,
      productSlugs: [product.slug],
    });

    const festival = await campaigns.create({ ...draft, slug, kind: 'FESTIVAL' }, owner.id);
    expect(festival).toMatchObject({ kind: 'FESTIVAL', status: 'DRAFT', revision: 1 });
    const move = (action: CampaignAction, expectedRevision: number, requestId = randomUUID()) =>
      campaigns.transition(festival.id, { action, expectedRevision, requestId }, owner.id);
    await expect(move('APPROVE', 1)).rejects.toThrow('A festival needs a landing');
    await landings.save(festival.id, { ...landing, expectedRevision: 1 }, owner.id);
    await expect(move('APPROVE', 2)).resolves.toMatchObject({ status: 'APPROVED', revision: 3 });
    await expect(move('PUBLISH_NOW', 3)).rejects.toThrow('start time has not arrived');
    await expect(move('SCHEDULE', 3)).resolves.toMatchObject({ status: 'SCHEDULED', revision: 4 });
    await expect(landings.publicLanding(slug, 1)).rejects.toThrow('not found');

    // Make only this fixture due, at the same moment its stock disappears.
    await db.$transaction([
      db.inventory.updateMany({
        where: { variant: { productId: product.id } },
        data: { onHand: 0 },
      }),
      db.campaign.update({ where: { id: festival.id }, data: { startsAt: start, endsAt: end } }),
    ]);
    await campaigns.advance(new Date());
    const blocked = await campaigns.detail(festival.id, 1);
    expect(blocked).toMatchObject({ status: 'PAUSED', revision: 5 });
    expect(blocked.history[0]).toMatchObject({
      action: 'PUBLICATION_BLOCKED',
      snapshot: { publicationError: 'The collection has no sellable products.' },
    });
    await db.inventory.updateMany({
      where: { variant: { productId: product.id } },
      data: { onHand: 3 },
    });
    await expect(move('REOPEN', 5)).resolves.toMatchObject({ status: 'DRAFT', revision: 6 });
    await expect(move('APPROVE', 6)).resolves.toMatchObject({ status: 'APPROVED', revision: 7 });
    await expect(move('PUBLISH_NOW', 7)).resolves.toMatchObject({ status: 'ACTIVE', revision: 8 });
    await expect(landings.publicLanding(slug, 1)).resolves.toMatchObject({
      active: true,
      isFestival: true,
      publicationVersion: 8,
    });
    await expect(landings.editor(festival.id)).resolves.toMatchObject({
      publishedVersions: [{ version: 8 }],
    });
    const conflict = await campaigns.create(
      {
        ...draft,
        slug: `${slug}-conflict`,
        kind: 'FESTIVAL',
        startsTehran: formatTehranDate(start),
        endsTehran: formatTehranDate(end),
      },
      owner.id,
    );
    const conflictLanding = await landings.save(
      conflict.id,
      { ...landing, expectedRevision: conflict.revision },
      owner.id,
    );
    await expect(
      campaigns.transition(
        conflict.id,
        { action: 'APPROVE', expectedRevision: conflictLanding.revision, requestId: randomUUID() },
        owner.id,
      ),
    ).rejects.toThrow('same period');
    await expect(
      landings.restorePublication(festival.id, { expectedRevision: 8, version: 8 }, owner.id),
    ).rejects.toThrow('current festival draft');
    await db.campaignLanding.update({
      where: { campaignId: festival.id },
      data: { title: 'عنوان خصوصی آزمایش' },
    });
    await db.campaignPlacement.deleteMany({ where: { campaignId: festival.id } });
    await expect(landings.publicLanding(slug, 1)).resolves.toMatchObject({
      title: landing.title,
      publicationVersion: 8,
    });
    await expect(landings.placement('NAVIGATION', undefined)).resolves.toMatchObject({
      banner: {
        campaignId: festival.id,
        publicationVersion: 8,
        display: { title: 'منوی منتشرشده' },
      },
    });
    await db.campaignLanding.update({
      where: { campaignId: festival.id },
      data: { title: landing.title },
    });
    await db.campaignPlacement.create({
      data: {
        campaignId: festival.id,
        slot: 'NAVIGATION',
        priority: 50,
        display: { title: 'منوی منتشرشده' },
      },
    });
    await expect(landings.sitemap()).resolves.toMatchObject({
      entries: expect.not.arrayContaining([expect.objectContaining({ slug })]),
    });
    await expect(move('ARCHIVE', 8)).rejects.toThrow('unavailable');
    await expect(move('PAUSE', 8)).resolves.toMatchObject({ status: 'PAUSED', revision: 9 });
    await expect(landings.publicLanding(slug, 1)).rejects.toThrow('not found');
    await expect(move('RESUME', 9)).resolves.toMatchObject({ status: 'SCHEDULED', revision: 10 });
    await campaigns.advance(new Date());
    await expect(campaigns.detail(festival.id, 1)).resolves.toMatchObject({
      status: 'ACTIVE',
      revision: 11,
    });

    await move('PAUSE', 11);
    await move('REOPEN', 12);
    const changed = await landings.save(
      festival.id,
      { ...landing, title: 'عنوان جدید پیش‌نویس', placements: [], expectedRevision: 13 },
      owner.id,
    );
    await expect(
      landings.restorePublication(
        festival.id,
        { expectedRevision: changed.revision, version: 2 },
        owner.id,
      ),
    ).rejects.toThrow('Published festival version not found');
    const restored = await landings.restorePublication(
      festival.id,
      { expectedRevision: changed.revision, version: 8 },
      owner.id,
    );
    expect(restored).toMatchObject({
      revision: 15,
      landing: { title: landing.title, placements: landing.placements },
    });
    await expect(
      db.campaignRevision.findUnique({
        where: { campaignId_version: { campaignId: festival.id, version: restored.revision } },
      }),
    ).resolves.toMatchObject({
      action: 'PUBLICATION_RESTORE',
      snapshot: { restoredFromVersion: 8 },
    });
    await expect(
      landings.restorePublication(
        festival.id,
        { expectedRevision: changed.revision, version: 8 },
        owner.id,
      ),
    ).rejects.toThrow('current festival draft');
    await expect(landings.publicLanding(slug, 1)).rejects.toThrow('not found');
    const approvedAgain = await move('APPROVE', restored.revision);
    const republished = await move('PUBLISH_NOW', approvedAgain.revision);
    await expect(landings.publicLanding(slug, 1)).resolves.toMatchObject({
      title: landing.title,
      publicationVersion: republished.revision,
    });

    await db.campaign.update({ where: { id: festival.id }, data: { endsAt: new Date() } });
    await campaigns.advance(new Date());
    await expect(campaigns.detail(festival.id, 1)).resolves.toMatchObject({
      status: 'ENDED',
      revision: 18,
    });
    await expect(landings.publicLanding(slug, 1)).resolves.toMatchObject({
      active: false,
      isFestival: true,
      products: { items: [] },
    });
    await expect(landings.publicLanding(slug, 2)).rejects.toThrow('not found');
    await expect(landings.publicLanding(slug, 1, new Date(), {}, true)).rejects.toThrow(
      'not found',
    );
    const archiveId = randomUUID();
    await expect(move('ARCHIVE', 18, archiveId)).resolves.toMatchObject({
      archivedAt: expect.any(String),
      revision: 19,
    });
    await expect(move('ARCHIVE', 18, archiveId)).resolves.toMatchObject({ revision: 19 });
    await expect(landings.publicLanding(slug, 1)).rejects.toThrow('not found');
  } finally {
    try {
      const owner = { owner: { phone } };
      const identities = await db.campaign.findMany({ where: owner, select: { trackingId: true } });
      await db.$transaction([
        db.campaignLanding.deleteMany({ where: { campaign: owner } }),
        db.campaignRevision.deleteMany({ where: { campaign: owner } }),
        db.campaign.deleteMany({ where: owner }),
        db.campaignLinkIdentity.deleteMany({
          where: { id: { in: identities.map(({ trackingId }) => trackingId) } },
        }),
        db.inventory.deleteMany({ where: { variant: { sku: slug } } }),
        db.productVariant.deleteMany({ where: { sku: slug } }),
        db.product.deleteMany({ where: { slug } }),
        db.warehouse.deleteMany({ where: { code: slug } }),
        db.user.deleteMany({ where: { phone } }),
      ]);
    } finally {
      await db.$disconnect();
    }
  }
}, 30_000);
