import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  type Campaign,
  type CampaignLanding,
  type Media,
} from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { CatalogService } from '../catalog/catalog.service';
import { PublicMediaUrlService } from '../catalog/public-media-url.service';
import { parseCampaignDestination } from '../growth-attribution/campaign-links.service';
import { readCampaignProducts } from './campaign-collection';
import { parseTehranDate } from './campaign-calendar';
import { validateCampaignPlacementAppearance } from './campaign-placement-appearance';
import { checkFestivalTheme, festivalThemePresets } from './festival-theme';
import { createFestivalTheme, requireFestivalThemeVersion } from './festival-theme-library.service';
import type {
  FestivalDesignDto,
  FestivalDesignEditorDto,
  FestivalArtworkDto,
  FestivalPreviewDto,
  FestivalSectionDto,
  PublicFestivalDesignDto,
  PublicFestivalSectionDto,
  SaveFestivalDesignDto,
} from './dto/festival-design.dto';

type CampaignProducts = Awaited<ReturnType<typeof readCampaignProducts>>;
type CampaignProduct = CampaignProducts['items'][number];
const sectionProductLimit = 12;
const sectionScanSize = 96;
const campaignOrigin = 'https://campaign.invalid';

function artworkIds({ mediaId, mobileMediaId, stillMediaId }: FestivalArtworkDto) {
  return [mediaId, mobileMediaId, stillMediaId].filter((id): id is string => Boolean(id));
}

export function readFestivalDesign(value: Prisma.JsonValue | undefined) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.schemaVersion !== 1)
    return null;
  return value as unknown as FestivalDesignDto;
}

function assetIds(sections: FestivalSectionDto[]) {
  return [
    ...new Set(
      sections.flatMap(({ artwork, slides }) => [
        ...artworkIds(artwork ?? {}),
        ...(slides ?? []).flatMap(artworkIds),
      ]),
    ),
  ];
}

function normalizeDesign(input: FestivalDesignDto): FestivalDesignDto {
  return {
    schemaVersion: 1,
    theme: input.theme,
    ...(input.themeSource ? { themeSource: input.themeSource } : {}),
    sections: input.sections.map(({ slides, entries, description, ...section }) => ({
      ...section,
      ...(description?.trim() ? { description: description.trim() } : {}),
      ...(entries
        ? {
            entries: entries.map(({ actionPath, ...entry }) => {
              if (actionPath && section.kind !== 'OFFERS')
                throw new BadRequestException('Offer links belong to the offers section.');
              const path = actionPath
                ? parseCampaignDestination(campaignOrigin, actionPath).href.slice(
                    campaignOrigin.length,
                  )
                : undefined;
              return { ...entry, ...(path ? { actionPath: path } : {}) };
            }),
          }
        : {}),
      ...(slides
        ? {
            slides: slides.map(({ actionPath, actionLabel, ...slide }) => {
              if (Boolean(actionPath) !== Boolean(actionLabel))
                throw new BadRequestException('Supply both the slide action label and link.');
              const path =
                actionPath && actionPath !== '#campaign-products'
                  ? parseCampaignDestination(campaignOrigin, actionPath).href.slice(
                      campaignOrigin.length,
                    )
                  : actionPath;
              return {
                ...slide,
                ...(path && actionLabel ? { actionPath: path, actionLabel } : {}),
              };
            }),
          }
        : {}),
    })),
  };
}

function sectionWindow(campaign: Campaign, section: FestivalSectionDto) {
  return {
    start: section.startsTehran ? parseTehranDate(section.startsTehran) : campaign.startsAt,
    end: section.endsTehran ? parseTehranDate(section.endsTehran) : campaign.endsAt,
  };
}

async function validateSections(
  tx: Prisma.TransactionClient,
  campaign: Campaign,
  design: FestivalDesignDto,
) {
  checkFestivalTheme(design.theme);
  const products = design.sections.find(({ kind }) => kind === 'PRODUCTS');
  if (!products?.enabled || products.startsTehran || products.endsTehran)
    throw new BadRequestException('Keep the full product list enabled throughout the campaign.');

  for (const section of design.sections) {
    const { start, end } = sectionWindow(campaign, section);
    if (section.enabled && (start < campaign.startsAt || end > campaign.endsAt || end <= start))
      throw new BadRequestException('Keep section dates inside the campaign window.');
    if (section.slides?.length && section.kind !== 'HERO')
      throw new BadRequestException('Slides belong to the hero section.');
    if (section.artwork && artworkIds(section.artwork).length) {
      if (!section.artwork.mediaId || section.kind === 'HERO' || section.kind === 'COUNTDOWN')
        throw new BadRequestException(
          'Section artwork needs a desktop image in a content section.',
        );
      await validateCampaignPlacementAppearance(tx, 'HOME', section.artwork);
    }
    for (const slide of section.slides ?? []) {
      await validateCampaignPlacementAppearance(tx, 'HOME', {
        mediaId: slide.mediaId,
        mobileMediaId: slide.mobileMediaId,
        stillMediaId: slide.stillMediaId,
      });
    }
    if (section.kind === 'BUDGET' && section.entries?.some(({ maxPriceToman }) => !maxPriceToman))
      throw new BadRequestException('Set a maximum price for each budget group.');
  }
}

function automaticSection(section: FestivalSectionDto) {
  return (
    !section.slugs?.length &&
    (section.kind === 'DISCOUNTS' || section.kind === 'LOW_QUOTA' || section.kind === 'OFFERS')
  );
}

function matchesSection(section: FestivalSectionDto, product: CampaignProduct, campaignId: string) {
  const { campaignOffer, campaignQuota } = product;
  if (section.kind === 'PICKS') return true;
  if (section.kind === 'LOW_QUOTA')
    return (
      campaignQuota?.campaignId === campaignId &&
      campaignQuota.remaining > 0 &&
      campaignQuota.remaining <= (section.threshold ?? 3)
    );
  return (
    campaignOffer?.campaignId === campaignId &&
    (section.kind === 'OFFERS' ||
      (campaignOffer.price?.discountPercent ?? 0) >= (section.threshold ?? 10))
  );
}

@Injectable()
export class FestivalDesignService {
  constructor(
    private readonly db: PrismaService,
    private readonly catalog: CatalogService,
    private readonly mediaUrls: PublicMediaUrlService,
  ) {}

  async editor(campaignId: string): Promise<FestivalDesignEditorDto> {
    const campaign = await this.db.campaign.findUnique({
      where: { id: campaignId },
      select: {
        revision: true,
        landing: { select: { design: true } },
        revisions: {
          where: { action: { in: ['FESTIVAL_EDIT', 'FESTIVAL_RESTORE'] } },
          select: { version: true, recordedAt: true },
          orderBy: { version: 'desc' },
          take: 30,
        },
      },
    });
    if (!campaign) throw new NotFoundException('Campaign not found.');
    const design = readFestivalDesign(campaign.landing?.design);
    const [templates, assets] = await Promise.all([
      this.db.festivalThemeTemplate.findMany({
        where: { archivedAt: null },
        orderBy: { name: 'asc' },
        take: 100,
      }),
      this.assets(this.db, design?.sections ?? []),
    ]);
    return {
      revision: campaign.revision,
      design,
      presets: [
        ...festivalThemePresets,
        ...templates.map(({ name, theme }) => ({
          name,
          theme: theme as unknown as FestivalDesignDto['theme'],
        })),
      ],
      media: assets.map((row) => this.media(row)).filter((row) => row !== null),
      history: campaign.revisions.map(({ version, recordedAt }) => ({
        revision: version,
        recordedAt: recordedAt.toISOString(),
      })),
    };
  }

  async save(campaignId: string, input: SaveFestivalDesignDto, actorUserId: string) {
    const design = normalizeDesign(input);
    await this.change(campaignId, input.expectedRevision, actorUserId, async (tx) => {
      if (input.saveThemeAs) {
        await createFestivalTheme(
          tx,
          { name: input.saveThemeAs, theme: design.theme },
          actorUserId,
        );
      }
      return design;
    });
    return this.editor(campaignId);
  }

  async restore(
    campaignId: string,
    expectedRevision: number,
    version: number,
    actorUserId: string,
  ) {
    await this.change(
      campaignId,
      expectedRevision,
      actorUserId,
      async (tx) => {
        const revision = await tx.campaignRevision.findFirst({
          where: { campaignId, version, action: { in: ['FESTIVAL_EDIT', 'FESTIVAL_RESTORE'] } },
          select: { snapshot: true },
        });
        const snapshot = revision?.snapshot;
        const design =
          snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)
            ? readFestivalDesign(snapshot.design)
            : null;
        if (!design) throw new NotFoundException('Festival version was not found.');
        return design;
      },
      'FESTIVAL_RESTORE',
    );
    return this.editor(campaignId);
  }

  private async change(
    campaignId: string,
    expectedRevision: number,
    actorUserId: string,
    selectDesign: (tx: Prisma.TransactionClient) => Promise<FestivalDesignDto>,
    action = 'FESTIVAL_EDIT',
  ) {
    await this.db.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM "campaigns" WHERE id = ${campaignId}::uuid FOR UPDATE`;
        const campaign = await tx.campaign.findUnique({
          where: { id: campaignId },
          include: { landing: true },
        });
        if (!campaign?.landing)
          throw new NotFoundException('Save the campaign landing before setting a theme.');
        if (campaign.status !== 'DRAFT' || campaign.revision !== expectedRevision)
          throw new ConflictException('Only the current draft revision can be edited.');
        const design = await selectDesign(tx);
        await validateSections(tx, campaign, design);
        if (design.themeSource) {
          const previous = readFestivalDesign(campaign.landing.design)?.themeSource;
          const sameSource =
            previous?.name === design.themeSource.name &&
            previous?.version === design.themeSource.version;
          await requireFestivalThemeVersion(
            tx,
            design.themeSource,
            sameSource || action === 'FESTIVAL_RESTORE',
          );
        }
        const version = campaign.revision + 1;
        const stored = JSON.parse(JSON.stringify(design)) as Prisma.InputJsonObject;
        const assets = assetIds(design.sections);
        await tx.campaignLanding.update({ where: { campaignId }, data: { design: stored } });
        await tx.campaign.update({ where: { id: campaignId }, data: { revision: version } });
        await tx.campaignRevision.create({
          data: {
            campaignId,
            version,
            action,
            actorUserId,
            snapshot: { design: stored },
            ...(assets.length
              ? { festivalAssets: { createMany: { data: assets.map((mediaId) => ({ mediaId })) } } }
              : {}),
          },
        });
      },
      { timeout: 10_000 },
    );
  }

  async preview(campaignId: string, input: FestivalDesignDto): Promise<FestivalPreviewDto> {
    const design = normalizeDesign(input);
    return this.db.$transaction(
      async (tx) => {
        const landing = await tx.campaignLanding.findUnique({
          where: { campaignId },
          include: { campaign: true },
        });
        if (!landing) throw new NotFoundException('Campaign landing not found.');
        const { campaign, slug, title, story } = landing;
        await validateSections(tx, campaign, design);
        const loaded = await readCampaignProducts(
          this.catalog,
          tx,
          campaign,
          landing,
          1,
          8,
          {},
          {
            includeFilterOptions: true,
          },
        );
        const { facets: _facets, ...products } = loaded;
        return {
          slug,
          title,
          story,
          campaignId,
          endsAt: campaign.endsAt.toISOString(),
          products,
          design: await this.project(tx, campaign, landing, design, loaded, new Date(), true),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 10_000 },
    );
  }

  async checkPublish(tx: Prisma.TransactionClient, campaign: Campaign, landing: CampaignLanding) {
    const design = readFestivalDesign(landing.design);
    if (design) await validateSections(tx, campaign, design);
  }

  async project(
    tx: Prisma.TransactionClient,
    campaign: Campaign,
    landing: CampaignLanding,
    design: FestivalDesignDto,
    products: CampaignProducts,
    now: Date,
    preview = false,
    rebase = false,
  ): Promise<PublicFestivalDesignDto> {
    const configured = design.sections.filter(({ enabled }) => enabled);
    const windows = preview
      ? []
      : configured.map((section) => ({ section, ...sectionWindow(campaign, section) }));
    const sections = preview
      ? configured
      : windows.filter(({ start, end }) => start <= now && end > now).map(({ section }) => section);
    const [assets, base, automatic] = await Promise.all([
      this.assets(tx, sections),
      rebase
        ? readCampaignProducts(
            this.catalog,
            tx,
            campaign,
            landing,
            1,
            0,
            {},
            { includeFilterOptions: true },
          )
        : products,
      this.automaticProducts(tx, campaign, landing, sections.filter(automaticSection)),
    ]);
    const byId = new Map(assets.map((asset) => [asset.id, asset]));
    const projected: PublicFestivalSectionDto[] = [];
    for (const section of sections) {
      const { kind, title, layout, highlighted } = section;
      const description = section.description || (kind === 'INTRO' ? landing.story : undefined);
      const artwork = section.artwork;
      const view = {
        kind,
        title,
        layout,
        ...(description ? { description } : {}),
        ...(highlighted ? { highlighted } : {}),
        ...(artwork?.mediaId
          ? {
              artwork: {
                media: this.media(byId.get(artwork.mediaId)),
                mobileMedia: this.media(
                  artwork.mobileMediaId ? byId.get(artwork.mobileMediaId) : undefined,
                ),
                stillMedia: this.media(
                  artwork.stillMediaId ? byId.get(artwork.stillMediaId) : undefined,
                ),
              },
            }
          : {}),
      };
      const limit = section.itemLimit ?? sectionProductLimit;
      if (kind === 'HERO') {
        projected.push({
          ...view,
          slides: (section.slides ?? []).map(
            ({ mediaId, mobileMediaId, stillMediaId, ...copy }) => ({
              ...copy,
              media: this.media(byId.get(mediaId)),
              mobileMedia: this.media(mobileMediaId ? byId.get(mobileMediaId) : undefined),
              stillMedia: this.media(stillMediaId ? byId.get(stillMediaId) : undefined),
            }),
          ),
        });
      } else if (kind === 'CATEGORIES') {
        const facetSlugs = (base.facets?.categories ?? []).map(({ value }) => value);
        const eligibleSlugs = new Set(facetSlugs);
        const slugs = (
          section.slugs?.length
            ? section.slugs.filter((slug) => eligibleSlugs.has(slug))
            : facetSlugs
        ).slice(0, limit);
        const rows = slugs.length
          ? await tx.category.findMany({
              where: { slug: { in: slugs }, isActive: true, deletedAt: null },
              include: { image: true, featuredImage: true },
            })
          : [];
        const bySlug = new Map(rows.map((row) => [row.slug, row]));
        const categories = slugs.flatMap((slug) => {
          const row = bySlug.get(slug);
          return row
            ? [
                {
                  slug,
                  name: row.name,
                  media: this.media(row.featuredImage) ?? this.media(row.image),
                },
              ]
            : [];
        });
        projected.push({ ...view, categories });
      } else if (
        kind === 'PICKS' ||
        kind === 'DISCOUNTS' ||
        kind === 'LOW_QUOTA' ||
        kind === 'OFFERS'
      ) {
        let matching = automatic.get(kind) ?? [];
        if (section.slugs?.length) {
          const rows = await tx.product.findMany({
            where: { slug: { in: section.slugs }, deletedAt: null, status: 'ACTIVE' },
            select: { slug: true, id: true },
          });
          const ids = new Map(rows.map(({ slug, id }) => [slug, id]));
          matching = (
            await readCampaignProducts(
              this.catalog,
              tx,
              campaign,
              landing,
              1,
              24,
              {},
              { pickedIds: section.slugs.flatMap((slug) => ids.get(slug) ?? []) },
            )
          ).items.filter((product) => matchesSection(section, product, campaign.id));
        }
        projected.push({
          ...view,
          products: matching.slice(0, limit),
          ...(kind === 'OFFERS' && section.entries?.length ? { entries: section.entries } : {}),
        });
      } else {
        projected.push({
          ...view,
          ...(section.entries?.length ? { entries: section.entries } : {}),
        });
      }
    }
    const changeTimes = windows.flatMap(({ start, end }) =>
      [start, end].filter((time) => time > now && time < campaign.endsAt),
    );
    const nextChange = changeTimes.length
      ? Math.min(...changeTimes.map((time) => time.getTime()))
      : null;
    return {
      theme: design.theme,
      sections: projected,
      filterCategories: base.facets?.categories ?? [],
      filterBrands: base.facets?.brands ?? [],
      ...(nextChange !== null ? { refreshAt: new Date(nextChange).toISOString() } : {}),
    };
  }

  private async automaticProducts(
    tx: Prisma.TransactionClient,
    campaign: Campaign,
    landing: CampaignLanding,
    sections: FestivalSectionDto[],
  ) {
    const results = new Map<FestivalSectionDto['kind'], CampaignProduct[]>();
    if (!sections.length) return results;
    const [campaignPromotions, quotas] = await Promise.all([
      this.catalog.campaignCollectionPromotions(tx),
      sections.some(({ kind }) => kind === 'LOW_QUOTA')
        ? tx.campaignQuota.findMany({
            where: { campaignId: campaign.id, campaign: { promotion: { isNot: null } } },
            select: { productId: true },
          })
        : [],
    ]);
    const promotion = campaignPromotions.find(({ campaignId }) => campaignId === campaign.id);
    let pending = sections.filter((section) => {
      if (section.kind === 'LOW_QUOTA') return quotas.length > 0;
      if (!promotion) return false;
      if (section.kind === 'OFFERS') return true;
      return (
        promotion.kind === 'PERCENT' &&
        !promotion.couponCode &&
        promotion.minSubtotalToman === 0 &&
        campaign.audience === 'ALL_CUSTOMERS' &&
        Math.round(Math.min(promotion.value, promotion.maxDiscountBps) / 100) >=
          (section.threshold ?? 10)
      );
    });
    if (!pending.length) return results;
    const candidateIds = pending.every(({ kind }) => kind === 'LOW_QUOTA')
      ? quotas.map(({ productId }) => productId)
      : promotion?.kind === 'BUNDLE'
        ? [...new Set([...promotion.bundleProductIds, ...quotas.map(({ productId }) => productId)])]
        : undefined;
    let page = 1;
    while (pending.length) {
      const products = await readCampaignProducts(
        this.catalog,
        tx,
        campaign,
        landing,
        page,
        sectionScanSize,
        {},
        { candidateIds, campaignPromotions },
      );
      for (const section of pending) {
        const selected = results.get(section.kind) ?? [];
        const remaining = (section.itemLimit ?? sectionProductLimit) - selected.length;
        selected.push(
          ...products.items
            .filter((product) => matchesSection(section, product, campaign.id))
            .slice(0, remaining),
        );
        results.set(section.kind, selected);
      }
      if (page >= products.totalPages) break;
      page += 1;
      pending = pending.filter(
        (section) =>
          results.get(section.kind)?.length !== (section.itemLimit ?? sectionProductLimit),
      );
    }
    return results;
  }

  private assets(reader: Pick<Prisma.TransactionClient, 'media'>, sections: FestivalSectionDto[]) {
    const ids = assetIds(sections);
    return ids.length
      ? reader.media.findMany({ where: { id: { in: ids }, deletedAt: null } })
      : Promise.resolve([]);
  }

  private media(asset: Media | null | undefined) {
    return asset && !asset.deletedAt
      ? {
          id: asset.id,
          mimeType: asset.mimeType,
          altText: asset.altText,
          url: this.mediaUrls.resolve(asset.storageKey),
        }
      : null;
  }
}
