import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type Campaign, type Media } from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { PublicMediaUrlService } from '../catalog/public-media-url.service';
import { normalizeAttributionToken } from '../growth-attribution/attribution';
import {
  ensureCampaignLinkIdentity,
  parseCampaignDestination,
} from '../growth-attribution/campaign-links.service';
import { formatTehranDate, parseTehranDate } from './campaign-calendar';
import { campaignTransition } from './campaign-lifecycle';
import type {
  CampaignDetailDto,
  CampaignDraftDto,
  CampaignListDto,
  CampaignSummaryDto,
  CampaignTransitionDto,
  CreateCampaignDto,
  PublicCampaignDto,
  UpdateCampaignDto,
} from './dto/campaign.dto';

const pageSize = 25;
const canonicalOrigin = 'https://campaign.invalid';

function summarize(campaign: Campaign): CampaignSummaryDto {
  return {
    id: campaign.id,
    slug: campaign.slug,
    name: campaign.name,
    ownerId: campaign.ownerId,
    status: campaign.status,
    revision: campaign.revision,
    startsAt: campaign.startsAt.toISOString(),
    endsAt: campaign.endsAt.toISOString(),
    startsTehran: formatTehranDate(campaign.startsAt),
    endsTehran: formatTehranDate(campaign.endsAt),
  };
}

@Injectable()
export class CampaignsService {
  constructor(
    private readonly db: PrismaService,
    private readonly mediaUrls: PublicMediaUrlService,
  ) {}

  async list(page: number): Promise<CampaignListDto> {
    const rows = await this.db.campaign.findMany({
      orderBy: [{ startsAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize + 1,
    });
    return { items: rows.slice(0, pageSize).map(summarize), page, hasMore: rows.length > pageSize };
  }

  async detail(id: string, historyPage: number): Promise<CampaignDetailDto> {
    const campaign = await this.db.campaign.findUnique({
      where: { id },
      include: {
        tracking: { select: { campaign: true } },
        media: true,
        revisions: {
          orderBy: { version: 'desc' },
          skip: (historyPage - 1) * pageSize,
          take: pageSize + 1,
        },
      },
    });
    if (!campaign) throw new NotFoundException('Campaign not found.');
    const [products, categories] = await Promise.all([
      this.db.product.findMany({
        where: { id: { in: campaign.productIds } },
        select: { slug: true },
        orderBy: { slug: 'asc' },
      }),
      this.db.category.findMany({
        where: { id: { in: campaign.categoryIds } },
        select: { slug: true },
        orderBy: { slug: 'asc' },
      }),
    ]);
    return {
      ...summarize(campaign),
      goal: campaign.goal,
      channel: campaign.channel,
      trackingId: campaign.trackingId,
      trackingLabel: campaign.tracking.campaign,
      allProducts: campaign.allProducts,
      productSlugs: products.map(({ slug }) => slug),
      categorySlugs: categories.map(({ slug }) => slug),
      budgetToman: campaign.budgetToman,
      message: campaign.message,
      bannerEnabled: campaign.bannerEnabled,
      bannerPriority: campaign.bannerPriority,
      ctaPath: campaign.ctaPath,
      ctaLabel: campaign.ctaLabel,
      media: this.media(campaign.media),
      history: campaign.revisions
        .slice(0, pageSize)
        .map(({ version, action, actorUserId, snapshot, recordedAt }) => ({
          version,
          action,
          actorUserId,
          recordedAt: recordedAt.toISOString(),
          snapshot: snapshot as Prisma.JsonObject,
        })),
      historyPage,
      hasMoreHistory: campaign.revisions.length > pageSize,
    };
  }

  async create(input: CreateCampaignDto, actorUserId: string): Promise<CampaignSummaryDto> {
    const trackingId = normalizeAttributionToken(input.trackingId, 64);
    const trackingLabel = normalizeAttributionToken(input.trackingLabel);
    if (!trackingId || !trackingLabel)
      throw new BadRequestException('Enter valid campaign tracking labels.');

    try {
      return await this.db.$transaction(async (tx) => {
        const draft = await this.prepareDraft(tx, input);
        await ensureCampaignLinkIdentity(tx, trackingId, trackingLabel);
        const campaign = await tx.campaign.create({
          data: { ...draft, slug: input.slug, trackingId, ownerId: actorUserId },
        });
        await this.recordRevision(tx, campaign, 'CREATE', actorUserId);
        return summarize(campaign);
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('This campaign slug or tracking identifier is already in use.');
      }
      throw error;
    }
  }

  async update(
    id: string,
    input: UpdateCampaignDto,
    actorUserId: string,
  ): Promise<CampaignSummaryDto> {
    return this.db.$transaction(async (tx) => {
      const current = await this.lockCampaign(tx, id);
      this.assertRevision(current, input.expectedRevision);
      if (current.status !== 'DRAFT')
        throw new ConflictException('Only draft campaigns can be edited.');

      const draft = await this.prepareDraft(tx, input);
      const campaign = await tx.campaign.update({
        where: { id },
        data: { ...draft, revision: { increment: 1 } },
      });
      await this.recordRevision(tx, campaign, 'EDIT', actorUserId);
      return summarize(campaign);
    });
  }

  async transition(
    id: string,
    input: CampaignTransitionDto,
    actorUserId: string,
  ): Promise<CampaignSummaryDto> {
    return this.db.$transaction(async (tx) => {
      const current = await this.lockCampaign(tx, id);
      const previous = await tx.campaignRevision.findUnique({
        where: { campaignId_requestId: { campaignId: id, requestId: input.requestId } },
        select: { action: true, actorUserId: true },
      });
      if (previous) {
        if (previous.action !== input.action || previous.actorUserId !== actorUserId) {
          throw new ConflictException('This transition request was already used.');
        }
        return summarize(current);
      }
      this.assertRevision(current, input.expectedRevision);
      const status = campaignTransition(current.status, input.action);
      if (!status)
        throw new ConflictException(
          'This transition is unavailable for the current campaign status.',
        );
      if (status === current.status) return summarize(current);

      if (status === 'APPROVED' || status === 'SCHEDULED') {
        if (current.endsAt <= new Date())
          throw new BadRequestException('The campaign end time has passed.');
        await this.validateScope(tx, current);
        if (current.mediaId) await this.checkMedia(tx, current.mediaId);
      }
      return summarize(
        await this.setStatus(tx, current, status, input.action, actorUserId, input.requestId),
      );
    });
  }

  async advance(now = new Date()): Promise<number> {
    return this.db.$transaction(async (tx) => {
      const due = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "campaigns"
        WHERE ("status" IN ('SCHEDULED', 'ACTIVE', 'PAUSED') AND "endsAt" <= ${now})
          OR ("status" = 'SCHEDULED' AND "startsAt" <= ${now})
        ORDER BY "endsAt", id
        LIMIT 25 FOR UPDATE SKIP LOCKED
      `;
      if (due.length === 0) return 0;
      const rows = await tx.campaign.findMany({ where: { id: { in: due.map(({ id }) => id) } } });
      for (const campaign of rows) {
        const ended = campaign.endsAt <= now;
        await this.setStatus(
          tx,
          campaign,
          ended ? 'ENDED' : 'ACTIVE',
          ended ? 'EXPIRE' : 'PUBLISH',
          null,
        );
      }
      return rows.length;
    });
  }

  async publicBanner(now = new Date()): Promise<PublicCampaignDto> {
    const campaign = await this.db.campaign.findFirst({
      where: { status: 'ACTIVE', bannerEnabled: true, startsAt: { lte: now }, endsAt: { gt: now } },
      orderBy: [{ bannerPriority: 'desc' }, { startsAt: 'desc' }, { id: 'asc' }],
      select: {
        name: true,
        message: true,
        ctaPath: true,
        ctaLabel: true,
        media: true,
        endsAt: true,
      },
    });
    return {
      banner: campaign && {
        name: campaign.name,
        message: campaign.message,
        ctaPath: campaign.ctaPath,
        ctaLabel: campaign.ctaLabel,
        endsAt: campaign.endsAt.toISOString(),
        media: this.media(campaign.media),
      },
    };
  }

  private async prepareDraft(tx: Prisma.TransactionClient, input: CampaignDraftDto) {
    const startsAt = parseTehranDate(input.startsTehran);
    const endsAt = parseTehranDate(input.endsTehran);
    if (startsAt >= endsAt)
      throw new BadRequestException('The end time must follow the start time.');
    const channel = normalizeAttributionToken(input.channel);
    if (!channel) throw new BadRequestException('Enter a valid campaign channel.');

    const productSlugs = [...new Set(input.productSlugs)];
    const categorySlugs = [...new Set(input.categorySlugs)];
    const hasSelection = productSlugs.length + categorySlugs.length > 0;
    if (input.allProducts === hasSelection) {
      throw new BadRequestException(
        'Choose all products or select active products and categories.',
      );
    }

    const [products, categories] = await Promise.all([
      tx.product.findMany({
        where: { slug: { in: productSlugs }, status: 'ACTIVE', deletedAt: null },
        select: { id: true },
        orderBy: { id: 'asc' },
      }),
      tx.category.findMany({
        where: { slug: { in: categorySlugs }, isActive: true, deletedAt: null },
        select: { id: true },
        orderBy: { id: 'asc' },
      }),
    ]);
    if (products.length !== productSlugs.length || categories.length !== categorySlugs.length) {
      throw new BadRequestException(
        'Some products or categories in the campaign scope are unavailable.',
      );
    }
    if (input.mediaId) await this.checkMedia(tx, input.mediaId);
    if (Boolean(input.ctaPath) !== Boolean(input.ctaLabel)) {
      throw new BadRequestException('Supply both the banner link and its label.');
    }
    const destination = input.ctaPath && parseCampaignDestination(canonicalOrigin, input.ctaPath);
    const ctaPath = destination ? destination.href.slice(canonicalOrigin.length) : null;
    if (ctaPath && ctaPath.length > 1000)
      throw new BadRequestException('The encoded banner link is too long.');

    return {
      name: input.name,
      goal: input.goal,
      channel,
      allProducts: input.allProducts,
      productIds: products.map(({ id }) => id),
      categoryIds: categories.map(({ id }) => id),
      startsAt,
      endsAt,
      budgetToman: input.budgetToman,
      message: input.message,
      bannerEnabled: input.bannerEnabled,
      bannerPriority: input.bannerPriority,
      mediaId: input.mediaId ?? null,
      ctaPath,
      ctaLabel: input.ctaLabel ?? null,
    };
  }

  private async validateScope(tx: Prisma.TransactionClient, campaign: Campaign) {
    const [products, categories] = await Promise.all([
      tx.product.count({
        where: { id: { in: campaign.productIds }, status: 'ACTIVE', deletedAt: null },
      }),
      tx.category.count({
        where: { id: { in: campaign.categoryIds }, isActive: true, deletedAt: null },
      }),
    ]);
    if (products !== campaign.productIds.length || categories !== campaign.categoryIds.length) {
      throw new BadRequestException(
        'Some products or categories in the campaign scope are unavailable.',
      );
    }
  }

  private async checkMedia(tx: Prisma.TransactionClient, id: string) {
    const media = await tx.media.findFirst({
      where: { id, deletedAt: null, mimeType: { startsWith: 'image/' } },
      select: { id: true },
    });
    if (!media) throw new BadRequestException('Choose an available campaign image.');
  }

  private media(media: Media | null) {
    if (!media || media.deletedAt) return null;
    return {
      id: media.id,
      mimeType: media.mimeType,
      url: this.mediaUrls.resolve(media.storageKey),
      altText: media.altText,
    };
  }

  private async lockCampaign(tx: Prisma.TransactionClient, id: string) {
    const [locked] = await tx.$queryRaw<
      Array<{ id: string }>
    >`SELECT id FROM "campaigns" WHERE id = ${id}::uuid FOR UPDATE`;
    if (!locked) throw new NotFoundException('Campaign not found.');
    return tx.campaign.findUniqueOrThrow({ where: { id: locked.id } });
  }

  private assertRevision(campaign: Campaign, expectedRevision: number) {
    if (campaign.revision !== expectedRevision) {
      throw new ConflictException('The campaign changed. Reload it before submitting.');
    }
  }

  private async setStatus(
    tx: Prisma.TransactionClient,
    current: Campaign,
    status: Campaign['status'],
    action: string,
    actorUserId: string | null,
    requestId?: string,
  ) {
    const campaign = await tx.campaign.update({
      where: { id: current.id },
      data: { status, revision: { increment: 1 } },
    });
    await this.recordRevision(tx, campaign, action, actorUserId, requestId);
    return campaign;
  }

  private async recordRevision(
    tx: Prisma.TransactionClient,
    campaign: Campaign,
    action: string,
    actorUserId: string | null,
    requestId?: string,
  ) {
    await tx.campaignRevision.create({
      data: {
        campaignId: campaign.id,
        version: campaign.revision,
        action,
        actorUserId,
        requestId,
        snapshot: {
          ...campaign,
          startsAt: campaign.startsAt.toISOString(),
          endsAt: campaign.endsAt.toISOString(),
          createdAt: campaign.createdAt.toISOString(),
          updatedAt: campaign.updatedAt.toISOString(),
        },
      },
    });
  }
}
