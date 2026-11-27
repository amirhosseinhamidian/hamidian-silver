import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Prisma,
  type Campaign,
  type CampaignBannerSlot,
  type CampaignLanding,
  type CampaignPlacement,
  type Media,
} from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { attachHumanAuditEvent } from '../audit/audit-event';
import { CatalogService } from '../catalog/catalog.service';
import {
  emptyCampaignProducts,
  readCampaignProducts,
  type CampaignProductFilters,
} from './campaign-collection';
import {
  festivalDesignAssetIds,
  FestivalDesignService,
  readFestivalDesign,
} from './festival-design.service';
import {
  activeFestivalPublication,
  festivalPublication,
  publicationPlacements,
  readFestivalPublication,
} from './festival-publication';
import { PublicMediaUrlService } from '../catalog/public-media-url.service';
import {
  readCampaignPlacementDisplay,
  validateCampaignPlacementAppearance,
} from './campaign-placement-appearance';
import { formatTehranDate, parseTehranDate } from './campaign-calendar';
import type { CampaignBannerDto } from './dto/campaign.dto';
import type { FestivalThemeDto } from './dto/festival-design.dto';
import type { RestoreFestivalPublicationDto } from './dto/campaign-landing.dto';
import type { FestivalPreviewDraftDto } from './dto/festival-preview.dto';
import type {
  CampaignCollectionFiltersDto,
  CampaignLandingDraftDto,
  CampaignLandingEditorDto,
  CampaignSitemapDto,
  PublicCampaignLandingDto,
  SaveCampaignLandingDto,
} from './dto/campaign-landing.dto';

const placementMedia = { media: true, mobileMedia: true, stillMedia: true } as const;
const headerSlots = ['NAVIGATION', 'COUNTDOWN'] as const;
type PlacementAppearance = Pick<
  CampaignPlacement,
  'slot' | 'endsAt' | 'desktopHeight' | 'mobileHeight' | 'textColor' | 'navigationEffect'
> & {
  display?: Prisma.JsonValue | Prisma.InputJsonValue;
  media?: Media | null;
  mobileMedia?: Media | null;
  stillMedia?: Media | null;
};
const productPageSize = 24;
const emptyProducts = emptyCampaignProducts();
const publicationActions = ['PUBLISH', 'PUBLISH_NOW'];
const activeWindow = (now: Date) =>
  ({
    status: 'ACTIVE',
    managementPurpose: null,
    startsAt: { lte: now },
    endsAt: { gt: now },
  }) satisfies Prisma.CampaignWhereInput;
const publicOrder: Prisma.CampaignLandingOrderByWithRelationInput[] = [
  { campaign: { startsAt: 'desc' } },
  { campaignId: 'asc' },
];

@Injectable()
export class CampaignLandingsService {
  constructor(
    private readonly db: PrismaService,
    private readonly catalog: CatalogService,
    private readonly mediaUrls: PublicMediaUrlService,
    @Optional() private readonly festivals?: FestivalDesignService,
    @Optional() private readonly config?: ConfigService,
  ) {}

  async editor(campaignId: string): Promise<CampaignLandingEditorDto> {
    const campaign = await this.db.campaign.findUnique({
      where: { id: campaignId },
      select: {
        kind: true,
        managementPurpose: true,
        revision: true,
        landing: { include: { placements: { include: placementMedia } } },
      },
    });
    if (!campaign) throw new NotFoundException('Campaign not found.');
    this.assertLandingKind(campaign);
    const landing = campaign.landing;
    if (!landing) return { revision: campaign.revision, landing: null };
    const [products, versions, categories, targets] = await Promise.all([
      this.db.product.findMany({
        where: { id: { in: landing.manualProductIds } },
        select: { id: true, slug: true },
      }),
      campaign.kind === 'FESTIVAL'
        ? this.db.campaignRevision.findMany({
            where: {
              campaignId,
              action: { in: publicationActions },
              snapshot: { path: ['publishedLanding', 'schemaVersion'], equals: 1 },
            },
            select: { version: true, recordedAt: true },
            orderBy: { version: 'desc' },
            take: 30,
          })
        : [],
      this.db.category.findMany({
        where: {
          id: {
            in: landing.placements.flatMap((row) =>
              row.slot === 'CATEGORY' && row.targetId ? [row.targetId] : [],
            ),
          },
        },
        select: { id: true, slug: true },
      }),
      this.db.product.findMany({
        where: {
          id: {
            in: landing.placements.flatMap((row) =>
              row.slot === 'PRODUCT' && row.targetId ? [row.targetId] : [],
            ),
          },
        },
        select: { id: true, slug: true },
      }),
    ]);
    const slugs = new Map(products.map((row) => [row.id, row.slug]));
    return {
      revision: campaign.revision,
      publishedVersions: versions.map(({ version, recordedAt }) => ({
        version,
        recordedAt: recordedAt.toISOString(),
      })),
      placementMedia: landing.placements
        .filter(
          ({ mediaId, mobileMediaId, stillMediaId }) => mediaId || mobileMediaId || stillMediaId,
        )
        .map((row) => ({
          slot: row.slot,
          media: this.media(row.media),
          mobileMedia: this.media(row.mobileMedia),
          stillMedia: this.media(row.stillMedia),
        })),
      landing: {
        slug: landing.slug,
        seoMode: landing.seoMode,
        title: landing.title,
        story: landing.story,
        collectionMode: landing.collectionMode,
        filters: landing.filters as CampaignCollectionFiltersDto,
        manualProductSlugs: landing.manualProductIds.flatMap((id) => slugs.get(id) ?? []),
        placements: landing.placements.map((row) => ({
          slot: row.slot,
          priority: row.priority,
          targetSlug:
            (row.slot === 'CATEGORY' ? categories : targets).find(({ id }) => id === row.targetId)
              ?.slug ?? row.targetId,
          startsTehran: row.startsAt ? formatTehranDate(row.startsAt) : null,
          endsTehran: row.endsAt ? formatTehranDate(row.endsAt) : null,
          appearance: {
            mediaId: row.mediaId,
            mobileMediaId: row.mobileMediaId,
            stillMediaId: row.stillMediaId,
            desktopHeight: row.desktopHeight,
            mobileHeight: row.mobileHeight,
            textColor: row.textColor,
            navigationEffect: row.navigationEffect,
            display: readCampaignPlacementDisplay(row.display),
          },
        })),
      },
    };
  }

  async recordPublication(tx: Prisma.TransactionClient, campaign: Campaign) {
    const landing = await tx.campaignLanding.findUniqueOrThrow({
      where: { campaignId: campaign.id },
      include: { placements: true },
    });
    const publishedLanding = festivalPublication(campaign, landing);
    await tx.campaignLanding.update({
      where: { campaignId: campaign.id },
      data: { publication: publishedLanding },
    });
    const mediaIds = new Set([
      campaign.mediaId,
      ...festivalDesignAssetIds(readFestivalDesign(landing.design)?.sections ?? []),
      ...landing.placements.flatMap(({ mediaId, mobileMediaId, stillMediaId }) => [
        mediaId,
        mobileMediaId,
        stillMediaId,
      ]),
    ]);
    return { publishedLanding, mediaIds: [...mediaIds].filter((id): id is string => Boolean(id)) };
  }

  async restorePublication(
    campaignId: string,
    input: RestoreFestivalPublicationDto,
    actorUserId: string,
  ) {
    await this.db.$transaction(
      async (tx) => {
        const [locked] = await tx.$queryRaw<
          Array<{ id: string }>
        >`SELECT id FROM "campaigns" WHERE id = ${campaignId}::uuid FOR UPDATE`;
        if (!locked) throw new NotFoundException('Campaign not found.');
        const campaign = await tx.campaign.findUniqueOrThrow({
          where: { id: campaignId },
          include: { landing: true },
        });
        if (
          campaign.kind !== 'FESTIVAL' ||
          campaign.status !== 'DRAFT' ||
          campaign.revision !== input.expectedRevision
        ) {
          throw new ConflictException(
            'Only the current festival draft can restore a published version.',
          );
        }
        const source = await tx.campaignRevision.findFirst({
          where: { campaignId, version: input.version, action: { in: publicationActions } },
          select: { snapshot: true },
        });
        const snapshot = source?.snapshot;
        const publication = readFestivalPublication(
          snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)
            ? snapshot.publishedLanding
            : undefined,
        );
        if (
          !publication ||
          !campaign.landing ||
          publication.landing.slug !== campaign.landing.slug ||
          publication.landing.seoMode !== campaign.landing.seoMode
        ) {
          throw new NotFoundException('Published festival version not found.');
        }

        const { filters, design, ...landing } = publication.landing;
        const placements = publicationPlacements(publication);
        const restoredCampaign = { ...campaign, ...publication.presentation };
        await this.validateLandingContents(
          tx,
          restoredCampaign,
          { ...campaign.landing, ...publication.landing },
          placements,
        );
        if (
          restoredCampaign.mediaId &&
          !(await tx.media.findFirst({
            where: { id: restoredCampaign.mediaId, deletedAt: null },
            select: { id: true },
          }))
        ) {
          throw new BadRequestException('Choose an available campaign image.');
        }
        await tx.campaignLanding.update({
          where: { campaignId },
          data: {
            ...landing,
            filters: filters as Prisma.InputJsonValue,
            design: design === null ? Prisma.DbNull : design,
          },
        });
        await tx.campaignPlacement.deleteMany({ where: { campaignId } });
        if (placements.length) {
          await tx.campaignPlacement.createMany({
            data: placements.map(({ display, ...row }) => ({
              ...row,
              campaignId,
              display: display === null ? Prisma.DbNull : display,
            })),
          });
        }
        const updated = await tx.campaign.update({
          where: { id: campaignId },
          data: { ...publication.presentation, revision: { increment: 1 } },
        });
        await tx.campaignRevision.create({
          data: {
            campaignId,
            version: updated.revision,
            actorUserId,
            action: 'PUBLICATION_RESTORE',
            snapshot: {
              restoredFromVersion: publication.version,
              landing: publication.landing,
              placements: publication.placements,
              presentation: publication.presentation,
            },
          },
        });
      },
      { timeout: 10_000 },
    );
    const editor = await this.editor(campaignId);
    return attachHumanAuditEvent(editor, {
      title: `نسخهٔ منتشرشدهٔ ${input.version} در پیش‌نویس جشنواره بازیابی شد.`,
      entityName: editor.landing?.title ?? null,
      operationType: 'UPDATE',
      changes: [
        {
          field: 'publishedVersion',
          label: 'نسخهٔ بازیابی‌شده',
          before: null,
          after: input.version,
        },
      ],
    });
  }

  async preview(campaignId: string, input: CampaignLandingDraftDto) {
    return this.db.$transaction(
      async (tx) => {
        const campaign = await tx.campaign.findUnique({ where: { id: campaignId } });
        if (!campaign) throw new NotFoundException('Campaign not found.');
        this.assertLandingKind(campaign);
        const prepared = await this.prepare(tx, campaign, input);
        const { total } = await this.readCollection(tx, campaign, prepared, 1, 0);
        return { total };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 10_000 },
    );
  }

  previewDesign(campaignId: string, { landing: draft, ...design }: FestivalPreviewDraftDto) {
    if (!this.festivals) throw new NotFoundException('Festival design not found.');
    return this.festivals.preview(campaignId, design, async (tx, saved, normalized) => {
      const { campaign } = saved;
      this.assertLandingKind(campaign);
      const prepared = draft ? await this.prepare(tx, campaign, draft) : undefined;
      const landing = prepared
        ? { ...saved, ...prepared, filters: prepared.filters as Prisma.JsonObject }
        : saved;
      let rows: PlacementAppearance[];
      if (prepared) {
        const selected = prepared.placements.filter(
          ({ slot }) => slot === 'NAVIGATION' || slot === 'COUNTDOWN',
        );
        const ids = [
          ...new Set(
            selected.flatMap(({ mediaId, mobileMediaId, stillMediaId }) =>
              [mediaId, mobileMediaId, stillMediaId].filter((id): id is string => Boolean(id)),
            ),
          ),
        ];
        const assets = ids.length
          ? await tx.media.findMany({ where: { id: { in: ids }, deletedAt: null } })
          : [];
        const byId = new Map(assets.map((asset) => [asset.id, asset]));
        rows = selected.map((row) => ({
          ...row,
          media: byId.get(row.mediaId ?? ''),
          mobileMedia: byId.get(row.mobileMediaId ?? ''),
          stillMedia: byId.get(row.stillMediaId ?? ''),
        }));
      } else {
        rows = await tx.campaignPlacement.findMany({
          where: { campaignId, slot: { in: [...headerSlots] } },
          include: placementMedia,
        });
      }
      const nav = rows.find(({ slot }) => slot === 'NAVIGATION');
      const bar = rows.find(({ slot }) => slot === 'COUNTDOWN');
      return {
        landing,
        placements: {
          ...(nav
            ? { navigation: this.projectPlacement(campaign, landing.slug, nav, normalized.theme) }
            : {}),
          ...(bar
            ? { announcement: this.projectPlacement(campaign, landing.slug, bar, normalized.theme) }
            : {}),
        },
      };
    });
  }

  async save(
    campaignId: string,
    input: SaveCampaignLandingDto,
    actorUserId: string,
  ): Promise<CampaignLandingEditorDto> {
    await this.db.$transaction(
      async (tx) => {
        const [locked] = await tx.$queryRaw<
          Array<{ id: string }>
        >`SELECT id FROM "campaigns" WHERE id = ${campaignId}::uuid FOR UPDATE`;
        if (!locked) throw new NotFoundException('Campaign not found.');
        const campaign = await tx.campaign.findUniqueOrThrow({
          where: { id: campaignId },
          include: { landing: true },
        });
        this.assertLandingKind(campaign);
        if (campaign.status !== 'DRAFT' || campaign.revision !== input.expectedRevision) {
          throw new ConflictException('Only the current draft revision can be edited.');
        }
        if (
          campaign.landing &&
          (campaign.landing.slug !== input.slug || campaign.landing.seoMode !== input.seoMode)
        ) {
          throw new BadRequestException('The saved landing path and SEO mode are fixed.');
        }
        await this.lockPath(tx, input.slug);
        const collision = await tx.campaignLanding.findFirst({
          where: {
            slug: input.slug,
            campaignId: { not: campaignId },
            campaign: { managementPurpose: null },
            ...(input.seoMode === 'RECURRING' ? { seoMode: 'TEMPORARY' } : {}),
          },
          select: { campaignId: true },
        });
        if (collision) throw new ConflictException('The landing path is already assigned.');

        const { placements, ...landing } = await this.prepare(tx, campaign, input);
        await tx.campaignLanding.upsert({
          where: { campaignId },
          create: { campaignId, ...landing },
          update: landing,
        });
        await tx.campaignPlacement.deleteMany({ where: { campaignId } });
        if (placements.length) {
          await tx.campaignPlacement.createMany({
            data: placements.map((placement) => ({ campaignId, ...placement })),
          });
        }
        const updated = await tx.campaign.update({
          where: { id: campaignId },
          data: { revision: { increment: 1 } },
        });
        await tx.campaignRevision.create({
          data: {
            campaignId,
            version: updated.revision,
            actorUserId,
            action: 'LANDING_EDIT',
            snapshot: {
              ...updated,
              archivedAt: updated.archivedAt?.toISOString() ?? null,
              startsAt: updated.startsAt.toISOString(),
              endsAt: updated.endsAt.toISOString(),
              createdAt: updated.createdAt.toISOString(),
              updatedAt: updated.updatedAt.toISOString(),
              landing,
              placements: placements.map((placement) => ({
                ...placement,
                startsAt: placement.startsAt?.toISOString() ?? null,
                endsAt: placement.endsAt?.toISOString() ?? null,
              })),
            },
          },
        });
      },
      { timeout: 10_000 },
    );
    return this.editor(campaignId);
  }

  async validateForPublication(tx: Prisma.TransactionClient, campaign: Campaign) {
    if (campaign.managementPurpose === 'SALES') return;
    const landing = await tx.campaignLanding.findUnique({
      where: { campaignId: campaign.id },
      include: { placements: true },
    });
    if (!landing) {
      if (campaign.kind === 'FESTIVAL') {
        throw new BadRequestException('A festival needs a landing before publication.');
      }
      return;
    }
    await this.lockPath(tx, landing.slug);
    const overlap = await tx.campaignLanding.findFirst({
      where: {
        slug: landing.slug,
        campaignId: { not: campaign.id },
        campaign: {
          managementPurpose: null,
          ...(campaign.kind !== 'FESTIVAL' && landing.seoMode !== 'RECURRING'
            ? { kind: 'FESTIVAL' }
            : {}),
          status: { in: ['APPROVED', 'SCHEDULED', 'ACTIVE', 'PAUSED'] },
          startsAt: { lt: campaign.endsAt },
          endsAt: { gt: campaign.startsAt },
        },
      },
      select: { campaignId: true },
    });
    if (overlap)
      throw new ConflictException('Another campaign uses this landing path in the same period.');
    await this.validateLandingContents(tx, campaign, landing, landing.placements);
  }

  private async validateLandingContents(
    tx: Prisma.TransactionClient,
    campaign: Campaign,
    landing: CampaignLanding,
    placements: Omit<CampaignPlacement, 'campaignId'>[],
  ) {
    for (const placement of placements) {
      this.checkWindow(campaign, placement);
      if (campaign.kind !== 'FESTIVAL') continue;
      const display = readCampaignPlacementDisplay(placement.display);
      await validateCampaignPlacementAppearance(tx, placement.slot, { ...placement, display });
      if (placement.targetId) {
        const target =
          placement.slot === 'CATEGORY'
            ? await tx.category.findFirst({
                where: { id: placement.targetId, isActive: true, deletedAt: null },
                select: { id: true },
              })
            : await tx.product.findFirst({
                where: { id: placement.targetId, status: 'ACTIVE', deletedAt: null },
                select: { id: true },
              });
        if (!target) throw new BadRequestException('Select a published banner target.');
      }
    }
    await this.festivals?.checkPublish(tx, campaign, landing);
    const { total } = await this.readCollection(tx, campaign, landing, 1, 0);
    if (total === 0) throw new BadRequestException('The collection has no sellable products.');
  }

  async publicLanding(
    slug: string,
    page: number,
    now = new Date(),
    selected: CampaignProductFilters = {},
    productsOnly = false,
  ): Promise<PublicCampaignLandingDto> {
    return this.db.$transaction(
      async (tx) => {
        const live = await tx.campaignLanding.findFirst({
          where: { slug, campaign: activeWindow(now) },
          include: { campaign: { include: { media: true } } },
          orderBy: publicOrder,
        });
        const stored =
          live ?? (page === 1 && !productsOnly ? await this.archivedLanding(tx, slug, now) : null);
        if (!stored) throw new NotFoundException('Campaign landing not found.');
        const published = live
          ? activeFestivalPublication(stored.publication, stored.campaign.revision)
          : readFestivalPublication(stored.publication);
        const campaign = await this.publicPresentation(tx, stored.campaign, published);
        const landing = { ...stored, ...published?.landing, campaign };
        const showOffer =
          live && this.config?.get<boolean>('CAMPAIGN_PROMOTIONS_ENABLED') !== false;
        const design = showOffer && !productsOnly ? readFestivalDesign(landing.design) : null;
        const rebase = Object.values(selected).some((value) => value !== undefined);
        const loaded = live
          ? await this.publicCollection(
              tx,
              landing.campaign,
              landing,
              page,
              productPageSize,
              selected,
              Boolean(design && this.festivals && !rebase),
            )
          : emptyProducts;
        const { facets: _facets, ...products } = loaded;
        if (page > 1 && page > products.totalPages)
          throw new NotFoundException('Collection page not found.');
        const projected =
          design && this.festivals
            ? await this.festivals.project(
                tx,
                landing.campaign,
                landing,
                design,
                loaded,
                now,
                false,
                rebase,
              )
            : null;
        return {
          slug: landing.slug,
          title: landing.title,
          ...(projected
            ? {
                design: projected,
                campaignId: landing.campaignId,
                endsAt: landing.campaign.endsAt.toISOString(),
              }
            : {}),
          story: landing.story,
          ...(published ? { publicationVersion: published.version } : {}),
          seoMode: landing.seoMode,
          isFestival: landing.campaign.kind === 'FESTIVAL',
          active: Boolean(live),
          media: this.media(landing.campaign.media),
          ctaPath: showOffer ? (landing.campaign.ctaPath ?? '/products') : '/products',
          ctaLabel: showOffer
            ? (landing.campaign.ctaLabel ?? 'مشاهدهٔ محصولات')
            : 'مشاهدهٔ محصولات فروشگاه',
          products,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 10_000 },
    );
  }

  private async archivedLanding(tx: Prisma.TransactionClient, slug: string, now: Date) {
    const completed = await tx.campaignLanding.findMany({
      where: {
        slug,
        seoMode: 'RECURRING',
        campaign: {
          archivedAt: null,
          managementPurpose: null,
          OR: [{ status: 'ENDED' }, { status: { in: ['ACTIVE', 'PAUSED'] }, endsAt: { lte: now } }],
          revisions: { some: { action: { in: publicationActions } } },
        },
      },
      include: {
        campaign: {
          include: {
            media: true,
            revisions: {
              where: {
                action: {
                  in: [...publicationActions, 'EDIT', 'CLASSIFY_FESTIVAL', 'LANDING_EDIT'],
                },
              },
              select: { action: true },
              orderBy: { version: 'desc' },
              take: 1,
            },
          },
        },
      },
      orderBy: publicOrder,
    });
    return (
      completed.find(
        ({ campaign, publication }) =>
          Boolean(readFestivalPublication(publication)) ||
          publicationActions.includes(campaign.revisions[0]?.action ?? ''),
      ) ?? null
    );
  }

  async placement(slot: CampaignBannerSlot, slug: string | undefined, now = new Date()) {
    if (this.config?.get<boolean>('CAMPAIGN_PROMOTIONS_ENABLED') === false) return null;
    return this.db.$transaction(
      async (tx) => {
        const selected = await this.findPlacement(tx, slot, slug, now);
        if (!selected) return null;
        const { stored, candidate, published, landing } = selected;
        const campaign = await this.publicPresentation(tx, stored.campaign, published);
        const ids = [candidate.mediaId, candidate.mobileMediaId, candidate.stillMediaId].filter(
          (id): id is string => Boolean(id),
        );
        const assets =
          published && ids.length
            ? await tx.media.findMany({ where: { id: { in: ids }, deletedAt: null } })
            : [];
        const byId = new Map(assets.map((asset) => [asset.id, asset]));
        const appearance = published
          ? {
              ...candidate,
              media: byId.get(candidate.mediaId ?? ''),
              mobileMedia: byId.get(candidate.mobileMediaId ?? ''),
              stillMedia: byId.get(candidate.stillMediaId ?? ''),
            }
          : candidate;
        return {
          priority: candidate.priority,
          startsAt: campaign.startsAt,
          campaignId: campaign.id,
          banner: {
            ...this.projectPlacement(
              campaign,
              landing.slug,
              appearance,
              readFestivalDesign(landing.design)?.theme,
            ),
            ...(published ? { publicationVersion: published.version } : {}),
          },
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 10_000 },
    );
  }

  private async findPlacement(
    tx: Prisma.TransactionClient,
    slot: CampaignBannerSlot,
    slug: string | undefined,
    now: Date,
  ) {
    const targetId = await this.resolveTarget(tx, slot, slug);
    if (slug && !targetId) return null;
    const matching = {
      slot,
      OR: [{ targetId: null }, ...(targetId ? [{ targetId }] : [])],
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
      ],
    } satisfies Prisma.CampaignPlacementWhereInput;
    const landings = await tx.campaignLanding.findMany({
      where: {
        campaign: activeWindow(now),
        OR: [
          { publication: { not: Prisma.DbNull } },
          { campaign: { bannerEnabled: true }, placements: { some: matching } },
        ],
      },
      include: {
        campaign: { include: { media: true } },
        placements: { where: matching, include: placementMedia },
      },
    });
    const choices = landings
      .flatMap((landing) => {
        const published = activeFestivalPublication(landing.publication, landing.campaign.revision);
        if (!(published?.presentation.bannerEnabled ?? landing.campaign.bannerEnabled)) return [];
        const rows = published
          ? publicationPlacements(published).filter(
              (candidate) =>
                candidate.slot === slot &&
                (candidate.targetId === null || candidate.targetId === targetId) &&
                (candidate.startsAt === null || candidate.startsAt <= now) &&
                (candidate.endsAt === null || candidate.endsAt > now),
            )
          : landing.placements;
        return rows.map((candidate) => ({ landing, candidate, published }));
      })
      .sort(
        (a, b) =>
          b.candidate.priority - a.candidate.priority ||
          b.landing.campaign.startsAt.getTime() - a.landing.campaign.startsAt.getTime() ||
          a.landing.campaignId.localeCompare(b.landing.campaignId),
      );
    for (const { landing: stored, candidate, published } of choices) {
      const landing = { ...stored, ...published?.landing };
      const { total } = await this.publicCollection(tx, stored.campaign, landing, 1, 0);
      if (total === 0) continue;
      return { stored, candidate, published, landing };
    }
    return null;
  }

  async operationsVisibility(
    tx: Prisma.TransactionClient,
    campaign: Campaign,
    stored: CampaignLanding,
    now: Date,
  ) {
    const active = await tx.campaignLanding.findFirst({
      where: { slug: stored.slug, campaign: activeWindow(now) },
      orderBy: publicOrder,
      select: { campaignId: true },
    });
    const live = active?.campaignId === campaign.id;
    const historical =
      !active &&
      !campaign.archivedAt &&
      stored.seoMode === 'RECURRING' &&
      (campaign.status === 'ENDED' ||
        ((campaign.status === 'ACTIVE' || campaign.status === 'PAUSED') &&
          campaign.endsAt <= now)) &&
      (await this.archivedLanding(tx, stored.slug, now))?.campaignId === campaign.id;
    const published = live
      ? activeFestivalPublication(stored.publication, campaign.revision)
      : readFestivalPublication(stored.publication);
    const previous = published
      ? null
      : await tx.campaignRevision.findFirst({
          where: { campaignId: campaign.id, action: { in: publicationActions } },
          orderBy: { version: 'desc' },
          select: { version: true },
        });
    const base = {
      version: published?.version ?? previous?.version ?? null,
      navigation: false,
      announcement: false,
    };
    if (!live) {
      return { ...base, publication: historical ? ('HISTORICAL' as const) : ('INACTIVE' as const) };
    }
    try {
      const landing = { ...stored, ...published?.landing };
      const { total } = await this.readCollection(tx, campaign, landing, 1, 0);
      if (total === 0) return { ...base, publication: 'EMPTY' as const };
    } catch (error) {
      if (error instanceof BadRequestException) return { ...base, publication: 'UNKNOWN' as const };
      throw error;
    }

    const [navigation, announcement] = await Promise.all(
      headerSlots.map((slot) => this.findPlacement(tx, slot, undefined, now)),
    );
    return {
      ...base,
      publication: 'LIVE' as const,
      navigation: navigation?.stored.campaignId === campaign.id,
      announcement: announcement?.stored.campaignId === campaign.id,
    };
  }

  private async publicPresentation(
    tx: Prisma.TransactionClient,
    campaign: Campaign & { media: Media | null },
    published: ReturnType<typeof readFestivalPublication>,
  ) {
    if (!published) return campaign;
    const { mediaId } = published.presentation;
    const media =
      mediaId === campaign.mediaId
        ? campaign.media
        : mediaId
          ? await tx.media.findFirst({ where: { id: mediaId, deletedAt: null } })
          : null;
    return { ...campaign, ...published.presentation, media };
  }

  private projectPlacement(
    campaign: Campaign & { media: Media | null },
    slug: string,
    candidate: PlacementAppearance,
    palette?: FestivalThemeDto,
  ): CampaignBannerDto {
    const endsAt =
      candidate.endsAt && candidate.endsAt < campaign.endsAt ? candidate.endsAt : campaign.endsAt;
    const saved = readCampaignPlacementDisplay(candidate.display);
    const theme = saved?.useTheme ? palette : undefined;
    const display = theme
      ? { ...saved, backgroundColor: theme.background, gradientColor: theme.gradient }
      : saved;
    const announcement = candidate.slot === 'COUNTDOWN';
    return {
      campaignId: campaign.id,
      name: campaign.name,
      message: display?.message ?? campaign.message,
      endsAt: endsAt.toISOString(),
      ...(announcement ? { countdownEndsAt: campaign.endsAt.toISOString() } : {}),
      ctaPath: (announcement && (display?.ctaPath ?? campaign.ctaPath)) || `/campaigns/${slug}`,
      ctaLabel: (announcement && (display?.ctaLabel ?? campaign.ctaLabel)) || 'دیدن مجموعه',
      media:
        candidate.slot === 'NAVIGATION'
          ? null
          : (this.media(candidate.media ?? null) ?? this.media(campaign.media)),
      mobileMedia: this.media(candidate.mobileMedia ?? null),
      stillMedia: this.media(candidate.stillMedia ?? null),
      desktopHeight: candidate.desktopHeight,
      mobileHeight: candidate.mobileHeight,
      textColor: theme?.foreground ?? candidate.textColor,
      navigationEffect: candidate.navigationEffect,
      ...(display ? { display } : {}),
    };
  }

  async sitemap(now = new Date()): Promise<CampaignSitemapDto> {
    return this.db.$transaction(
      async (tx) => {
        const landings = await tx.campaignLanding.findMany({
          where: {
            seoMode: 'RECURRING',
            campaign: { ...activeWindow(now), kind: { not: 'FESTIVAL' } },
          },
          include: { campaign: true },
          orderBy: publicOrder,
        });
        const entries: CampaignSitemapDto['entries'] = [];
        for (const landing of landings) {
          if (entries.some(({ slug }) => slug === landing.slug)) continue;
          const { total } = await this.publicCollection(tx, landing.campaign, landing, 1, 0);
          if (total > 0) {
            const latest =
              landing.updatedAt > landing.campaign.updatedAt
                ? landing.updatedAt
                : landing.campaign.updatedAt;
            entries.push({ slug: landing.slug, updatedAt: latest.toISOString() });
          }
        }
        return { entries };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 10_000 },
    );
  }

  private assertLandingKind({
    kind,
    managementPurpose,
  }: Pick<Campaign, 'kind' | 'managementPurpose'>) {
    if (kind === 'MARKETING') {
      throw new BadRequestException('Marketing campaigns do not have a landing.');
    }
    if (managementPurpose === 'SALES') {
      throw new BadRequestException('Sales offers do not have a landing.');
    }
  }

  private async prepare(
    tx: Prisma.TransactionClient,
    campaign: Campaign,
    input: CampaignLandingDraftDto,
  ) {
    const { slug, seoMode, title, story, collectionMode, filters, manualProductSlugs } = input;
    if (
      collectionMode === 'MANUAL' ? manualProductSlugs.length === 0 : manualProductSlugs.length > 0
    ) {
      throw new BadRequestException('Choose filtered collection or enter its manual products.');
    }
    const products = await tx.product.findMany({
      where: { slug: { in: manualProductSlugs }, status: 'ACTIVE', deletedAt: null },
      select: { id: true, slug: true, categories: { select: { categoryId: true } } },
    });
    if (
      products.length !== manualProductSlugs.length ||
      products.some(
        (product) =>
          !campaign.allProducts &&
          !campaign.productIds.includes(product.id) &&
          !product.categories.some(({ categoryId }) => campaign.categoryIds.includes(categoryId)),
      )
    ) {
      throw new BadRequestException('Select published products within the campaign scope.');
    }
    const idsBySlug = new Map(products.map((product) => [product.slug, product.id] as const));
    const placements = [];
    for (const inputPlacement of input.placements) {
      const { slot, priority } = inputPlacement;
      const targetSlug = inputPlacement.targetSlug?.trim();
      if (slot !== 'CATEGORY' && slot !== 'PRODUCT' && targetSlug)
        throw new BadRequestException('This placement does not take a target.');
      const targetId = await this.resolveTarget(tx, slot, targetSlug);
      if (targetSlug && !targetId)
        throw new BadRequestException('Select a published banner target.');
      const placement = {
        slot,
        priority,
        targetId,
        ...(await validateCampaignPlacementAppearance(tx, slot, inputPlacement.appearance)),
        startsAt: inputPlacement.startsTehran ? parseTehranDate(inputPlacement.startsTehran) : null,
        endsAt: inputPlacement.endsTehran ? parseTehranDate(inputPlacement.endsTehran) : null,
      };
      this.checkWindow(campaign, placement);
      placements.push(placement);
    }
    const storedFilters: Prisma.InputJsonObject = {
      ...(collectionMode === 'FILTERED'
        ? {
            categories: filters.categories ?? [],
            brands: filters.brands ?? [],
            ...(filters.minPriceToman != null ? { minPriceToman: filters.minPriceToman } : {}),
            ...(filters.maxPriceToman != null ? { maxPriceToman: filters.maxPriceToman } : {}),
            attributes: (filters.attributes ?? []).map(({ code, values, min, max }) => ({
              code,
              ...(values?.length ? { values } : {}),
              ...(min != null ? { min } : {}),
              ...(max != null ? { max } : {}),
            })),
            ...(filters.sort ? { sort: filters.sort } : {}),
          }
        : {}),
      minimumQuantity: filters.minimumQuantity ?? 1,
    };
    return {
      slug,
      seoMode,
      title,
      story,
      collectionMode,
      filters: storedFilters,
      manualProductIds: manualProductSlugs.map((key) => idsBySlug.get(key)!),
      placements,
    };
  }

  private readCollection(
    tx: Prisma.TransactionClient,
    campaign: Campaign,
    landing: Pick<CampaignLanding, 'collectionMode' | 'manualProductIds'> & {
      filters: Prisma.JsonValue | Prisma.InputJsonObject;
    },
    page: number,
    pageSize: number,
    selected: CampaignProductFilters = {},
    includeFilterOptions = false,
  ) {
    return readCampaignProducts(this.catalog, tx, campaign, landing, page, pageSize, selected, {
      includeFilterOptions,
    });
  }

  private async publicCollection(
    tx: Prisma.TransactionClient,
    campaign: Campaign,
    landing: CampaignLanding,
    page: number,
    pageSize = productPageSize,
    selected: CampaignProductFilters = {},
    includeFilterOptions = false,
  ) {
    try {
      return await this.readCollection(
        tx,
        campaign,
        landing,
        page,
        pageSize,
        selected,
        includeFilterOptions,
      );
    } catch (error) {
      if (error instanceof BadRequestException) return emptyProducts;
      throw error;
    }
  }

  private async resolveTarget(
    tx: Prisma.TransactionClient,
    slot: CampaignBannerSlot,
    slug?: string,
  ) {
    if (!slug || (slot !== 'CATEGORY' && slot !== 'PRODUCT')) return null;
    const record =
      slot === 'CATEGORY'
        ? await tx.category.findFirst({
            where: { slug, isActive: true, deletedAt: null },
            select: { id: true },
          })
        : await tx.product.findFirst({
            where: { slug, status: 'ACTIVE', deletedAt: null },
            select: { id: true },
          });
    return record?.id ?? null;
  }

  private checkWindow(
    campaign: Campaign,
    placement: { startsAt: Date | null; endsAt: Date | null },
  ) {
    const startsAt = placement.startsAt ?? campaign.startsAt;
    const endsAt = placement.endsAt ?? campaign.endsAt;
    if (startsAt < campaign.startsAt || endsAt > campaign.endsAt || startsAt >= endsAt) {
      throw new BadRequestException('Banner times must be within the campaign window.');
    }
  }

  private async lockPath(tx: Prisma.TransactionClient, slug: string) {
    await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${`campaign-landing:${slug}`}, 0))`;
  }

  private media(media: Media | null) {
    return media && !media.deletedAt
      ? {
          id: media.id,
          mimeType: media.mimeType,
          url: this.mediaUrls.resolve(media.storageKey),
          altText: media.altText,
        }
      : null;
  }
}
