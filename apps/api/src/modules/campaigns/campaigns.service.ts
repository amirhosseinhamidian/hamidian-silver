import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma, type Campaign, type Media } from '../../generated/prisma/client';
import { attachHumanAuditEvent } from '../audit/audit-event';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { PublicMediaUrlService } from '../catalog/public-media-url.service';
import { normalizeAttributionToken } from '../growth-attribution/attribution';
import {
  ensureCampaignLinkIdentity,
  parseCampaignDestination,
} from '../growth-attribution/campaign-links.service';
import {
  committedCampaignIncentives,
  discountBudget,
  promotionUsage,
} from '../promotions/promotion-budget';
import { formatTehranDate, parseTehranDate } from './campaign-calendar';
import { campaignTransition } from './campaign-lifecycle';
import { assertExclusiveQuotaWindow } from './campaign-quota';
import { CampaignLandingsService } from './campaign-landings.service';
import { campaignBudget, simulateCampaign } from './campaign-operations';
import { campaignTaxonomy, selectCampaignProducts } from './campaign-selection';
import type {
  CampaignProductQueryDto,
  CampaignSimulationInputDto,
} from './dto/campaign-operations.dto';
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
    kind: campaign.kind,
    status: campaign.status,
    archivedAt: campaign.archivedAt?.toISOString() ?? null,
    revision: campaign.revision,
    startsAt: campaign.startsAt.toISOString(),
    endsAt: campaign.endsAt.toISOString(),
    startsTehran: formatTehranDate(campaign.startsAt),
    endsTehran: formatTehranDate(campaign.endsAt),
  };
}

@Injectable()
export class CampaignsService {
  private readonly logger = new Logger(CampaignsService.name);

  constructor(
    private readonly db: PrismaService,
    private readonly mediaUrls: PublicMediaUrlService,
    @Optional() private readonly landings?: CampaignLandingsService,
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
        promotion: true,
        revisions: {
          orderBy: { version: 'desc' },
          skip: (historyPage - 1) * pageSize,
          take: pageSize + 1,
        },
      },
    });
    if (!campaign) throw new NotFoundException('Campaign not found.');
    const [products, categories, budget] = await Promise.all([
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
      campaignBudget(this.db, campaign, campaign.promotion, { warnings: true }),
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
      plannedChannelCostToman: campaign.plannedChannelCostToman,
      audience: campaign.audience,
      budget,
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

  selectProducts(query: CampaignProductQueryDto | string) {
    const filters = typeof query === 'string' ? { q: query } : query;
    return this.db.$transaction((tx) => selectCampaignProducts(tx, this.mediaUrls, filters), {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      timeout: 10_000,
    });
  }

  selectionTaxonomy() {
    return campaignTaxonomy(this.db);
  }

  async selectCollections(q?: string, page = 1) {
    if (q?.includes('\0')) throw new BadRequestException('Invalid collection search.');
    const rows = await this.db.campaignLanding.findMany({
      where: {
        collectionMode: 'FILTERED',
        campaign: { kind: { not: 'MARKETING' }, archivedAt: null },
        ...(q
          ? {
              OR: [
                { title: { contains: q, mode: 'insensitive' } },
                { slug: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: { campaignId: true, slug: true, title: true },
      orderBy: [{ updatedAt: 'desc' }, { campaignId: 'asc' }],
      skip: (page - 1) * 20,
      take: 21,
    });
    return {
      page,
      hasMore: rows.length > 20,
      items: rows
        .slice(0, 20)
        .map(({ campaignId, slug, title }) => ({ id: campaignId, slug, name: title })),
    };
  }

  async simulate(id: string, input: CampaignSimulationInputDto) {
    return this.db.$transaction(
      async (tx) => {
        const campaign = await tx.campaign.findUnique({
          where: { id },
          include: { promotion: true },
        });
        if (!campaign) throw new NotFoundException('Campaign not found.');
        this.assertRevision(campaign, input.expectedRevision);
        return simulateCampaign(tx, campaign, campaign.promotion, input);
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }

  async create(input: CreateCampaignDto, actorUserId: string): Promise<CampaignSummaryDto> {
    const kind = input.kind ?? 'LEGACY';
    const internalIdentity = kind === 'FESTIVAL' ? `festival-${randomUUID()}` : null;
    const trackingId = internalIdentity ?? normalizeAttributionToken(input.trackingId, 64);
    const trackingLabel = internalIdentity ?? normalizeAttributionToken(input.trackingLabel);
    if (!trackingId || !trackingLabel)
      throw new BadRequestException('Enter valid campaign tracking labels.');

    try {
      return await this.db.$transaction(async (tx) => {
        const draft = await this.prepareDraft(tx, input, kind);
        await ensureCampaignLinkIdentity(tx, trackingId, trackingLabel);
        const campaign = await tx.campaign.create({
          data: { ...draft, kind, slug: input.slug, trackingId, ownerId: actorUserId },
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

      const kind = input.kind ?? current.kind;
      if (kind !== current.kind && current.kind !== 'LEGACY') {
        throw new ConflictException('Only a legacy draft can be classified as a festival.');
      }
      const draft = await this.prepareDraft(tx, input, kind, current);
      if (
        discountBudget(draft) < discountBudget(current) &&
        discountBudget(draft) < committedCampaignIncentives(await promotionUsage(tx, id))
      )
        throw new BadRequestException('The discount budget is below existing commitments.');
      if (
        draft.startsAt.getTime() !== current.startsAt.getTime() ||
        draft.endsAt.getTime() !== current.endsAt.getTime()
      ) {
        const quotas = await tx.campaignQuota.findMany({
          where: { campaignId: id },
          select: { productId: true },
        });
        await assertExclusiveQuotaWindow(
          tx,
          id,
          draft,
          quotas.map(({ productId }) => productId),
        );
      }
      const campaign = await tx.campaign.update({
        where: { id },
        data: { ...draft, kind, revision: { increment: 1 } },
      });
      await this.recordRevision(
        tx,
        campaign,
        kind === current.kind ? 'EDIT' : 'CLASSIFY_FESTIVAL',
        actorUserId,
      );
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
      const { action, requestId } = input;
      if ((action === 'PUBLISH_NOW' || action === 'ARCHIVE') && current.kind !== 'FESTIVAL') {
        throw new ConflictException('This action is only available for sales festivals.');
      }
      const now = new Date();
      if (action === 'ARCHIVE') {
        if (current.status !== 'ENDED') {
          throw new ConflictException('Archiving is unavailable until the festival ends.');
        }
        if (current.archivedAt) return summarize(current);
        const archived = await tx.campaign.update({
          where: { id },
          data: { archivedAt: now, revision: { increment: 1 } },
        });
        await this.recordRevision(tx, archived, action, actorUserId, requestId);
        return attachHumanAuditEvent(summarize(archived), {
          title: `جشنوارهٔ «${current.name}» بایگانی شد.`,
          entityName: current.name,
          operationType: 'STATUS_CHANGE',
          changes: [
            { field: 'archivedAt', label: 'زمان بایگانی', before: null, after: now.toISOString() },
          ],
        });
      }
      const status = campaignTransition(current.status, action);
      if (!status)
        throw new ConflictException(
          'This transition is unavailable for the current campaign status.',
        );
      if (status === current.status) return summarize(current);

      if (action === 'PUBLISH_NOW' && current.startsAt > now) {
        throw new BadRequestException('The festival start time has not arrived.');
      }
      if (status === 'APPROVED' || status === 'SCHEDULED' || status === 'ACTIVE') {
        await this.validatePublication(tx, current, now);
      }
      const updated = summarize(
        await this.setStatus(tx, current, status, action, actorUserId, requestId),
      );
      if (action !== 'PAUSE' && action !== 'PUBLISH_NOW') return updated;
      return attachHumanAuditEvent(updated, {
        title:
          action === 'PAUSE'
            ? `کمپین «${current.name}» متوقف شد.`
            : `جشنوارهٔ «${current.name}» منتشر شد.`,
        entityName: current.name,
        operationType: 'STATUS_CHANGE',
        changes: [{ field: 'status', label: 'وضعیت کمپین', before: current.status, after: status }],
      });
    });
  }

  async advance(now = new Date()): Promise<number> {
    const dueWindow = Prisma.sql`
      ("status" IN ('SCHEDULED', 'ACTIVE', 'PAUSED') AND "endsAt" <= ${now})
      OR ("status" = 'SCHEDULED' AND "startsAt" <= ${now})
    `;
    const due = await this.db.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "campaigns" WHERE ${dueWindow}
      ORDER BY "endsAt", id LIMIT 25
    `;
    let advanced = 0;
    for (const { id } of due) {
      try {
        const changed = await this.db.$transaction(
          async (tx) => {
            const [locked] = await tx.$queryRaw<Array<{ id: string }>>`
              SELECT id FROM "campaigns" WHERE id = ${id}::uuid AND (${dueWindow})
              FOR UPDATE SKIP LOCKED
            `;
            if (!locked) return false;
            const campaign = await tx.campaign.findUniqueOrThrow({ where: { id } });
            if (campaign.endsAt <= now) {
              await this.setStatus(tx, campaign, 'ENDED', 'EXPIRE', null);
              return true;
            }
            if (campaign.kind === 'FESTIVAL') {
              try {
                await this.validatePublication(tx, campaign, now);
              } catch (error) {
                if (!(error instanceof BadRequestException || error instanceof ConflictException)) {
                  throw error;
                }
                await this.setStatus(
                  tx,
                  campaign,
                  'PAUSED',
                  'PUBLICATION_BLOCKED',
                  null,
                  undefined,
                  error.message,
                );
                return true;
              }
            }
            await this.setStatus(tx, campaign, 'ACTIVE', 'PUBLISH', null);
            return true;
          },
          { timeout: 10_000 },
        );
        if (changed) advanced++;
      } catch (error) {
        const category = error instanceof Error ? error.name : 'UnknownError';
        this.logger.warn(`Campaign ${id} could not advance (${category}).`);
      }
    }
    return advanced;
  }

  async publicActivity(now = new Date()) {
    const campaigns = await this.db.campaign.findMany({
      where: {
        status: 'ACTIVE',
        startsAt: { lte: now },
        endsAt: { gt: now },
        OR: [
          { bannerEnabled: true },
          { promotion: { isNot: null } },
          { landing: { design: { not: Prisma.DbNull } } },
        ],
      },
      select: { id: true },
    });
    return { activeIds: campaigns.map(({ id }) => id) };
  }

  async publicBanner(now = new Date()): Promise<PublicCampaignDto> {
    const [campaign, placement] = await Promise.all([
      this.db.campaign.findFirst({
        where: {
          status: 'ACTIVE',
          bannerEnabled: true,
          startsAt: { lte: now },
          endsAt: { gt: now },
          landing: null,
        },
        orderBy: [{ bannerPriority: 'desc' }, { startsAt: 'desc' }, { id: 'asc' }],
        select: {
          id: true,
          startsAt: true,
          bannerPriority: true,
          name: true,
          message: true,
          ctaPath: true,
          ctaLabel: true,
          media: true,
          endsAt: true,
        },
      }),
      this.landings?.placement('HOME', undefined, now),
    ]);
    if (
      placement &&
      (!campaign ||
        placement.priority > campaign.bannerPriority ||
        (placement.priority === campaign.bannerPriority &&
          (placement.startsAt > campaign.startsAt ||
            (placement.startsAt.getTime() === campaign.startsAt.getTime() &&
              placement.campaignId < campaign.id))))
    ) {
      return { banner: placement.banner };
    }
    return {
      banner: campaign && {
        campaignId: campaign.id,
        name: campaign.name,
        message: campaign.message,
        ctaPath: campaign.ctaPath,
        ctaLabel: campaign.ctaLabel,
        endsAt: campaign.endsAt.toISOString(),
        media: this.media(campaign.media),
      },
    };
  }

  private async prepareDraft(
    tx: Prisma.TransactionClient,
    input: CampaignDraftDto,
    kind: Campaign['kind'],
    current?: Campaign,
  ) {
    const startsAt = parseTehranDate(input.startsTehran);
    const endsAt = parseTehranDate(input.endsTehran);
    if (startsAt >= endsAt)
      throw new BadRequestException('The end time must follow the start time.');
    const channel =
      kind === 'FESTIVAL'
        ? (current?.channel ?? 'festival')
        : normalizeAttributionToken(input.channel);
    if (!channel) throw new BadRequestException('Enter a valid campaign channel.');
    const plannedChannelCostToman =
      input.plannedChannelCostToman === undefined || (current && current.kind !== kind)
        ? (current?.plannedChannelCostToman ?? null)
        : input.plannedChannelCostToman;
    if (plannedChannelCostToman !== null && plannedChannelCostToman > input.budgetToman)
      throw new BadRequestException('The planned channel cost exceeds the campaign budget.');

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
      plannedChannelCostToman,
      audience: input.audience ?? current?.audience ?? 'ALL_CUSTOMERS',
      message: input.message,
      bannerEnabled: input.bannerEnabled,
      bannerPriority: input.bannerPriority,
      mediaId: input.mediaId ?? null,
      ctaPath,
      ctaLabel: input.ctaLabel ?? null,
    };
  }

  private async validatePublication(tx: Prisma.TransactionClient, campaign: Campaign, now: Date) {
    if (campaign.endsAt <= now) throw new BadRequestException('The campaign end time has passed.');
    await this.validateScope(tx, campaign);
    if (campaign.mediaId) await this.checkMedia(tx, campaign.mediaId);
    if (campaign.kind === 'FESTIVAL' && !this.landings) {
      throw new BadRequestException('A festival needs a landing before publication.');
    }
    await this.landings?.validateForPublication(tx, campaign);
    const rule = await tx.campaignPromotion.findUnique({ where: { campaignId: campaign.id } });
    const budget = await campaignBudget(tx, campaign, rule);
    if (budget.blockers.length) throw new BadRequestException(budget.blockers[0]);
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
      where: { id, deletedAt: null, mimeType: { startsWith: 'image/', not: 'image/gif' } },
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
    publicationError?: string,
  ) {
    const campaign = await tx.campaign.update({
      where: { id: current.id },
      data: { status, revision: { increment: 1 } },
    });
    await this.recordRevision(tx, campaign, action, actorUserId, requestId, publicationError);
    return campaign;
  }

  private async recordRevision(
    tx: Prisma.TransactionClient,
    campaign: Campaign,
    action: string,
    actorUserId: string | null,
    requestId?: string,
    publicationError?: string,
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
          archivedAt: campaign.archivedAt?.toISOString() ?? null,
          startsAt: campaign.startsAt.toISOString(),
          endsAt: campaign.endsAt.toISOString(),
          createdAt: campaign.createdAt.toISOString(),
          updatedAt: campaign.updatedAt.toISOString(),
          ...(publicationError ? { publicationError } : {}),
        },
      },
    });
  }
}
