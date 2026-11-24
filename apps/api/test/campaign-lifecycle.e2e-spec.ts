import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { formatTehranDate } from '../src/modules/campaigns/campaign-calendar';
import type { CampaignAction } from '../src/modules/campaigns/campaign-lifecycle';
import { resolveHumanAuditEvent } from '../src/modules/audit/audit-event';
import { CampaignsService } from '../src/modules/campaigns/campaigns.service';
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
