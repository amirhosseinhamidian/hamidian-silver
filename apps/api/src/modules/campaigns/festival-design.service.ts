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
import type {
  FestivalDesignDto,
  FestivalDesignEditorDto,
  FestivalPreviewDto,
  FestivalSectionDto,
  FestivalThemePresetDto,
  PublicFestivalDesignDto,
  PublicFestivalSectionDto,
  SaveFestivalDesignDto,
} from './dto/festival-design.dto';

const presets: FestivalThemePresetDto[] = [
  {
    name: 'بلک فرایدی',
    theme: {
      background: '#15131a',
      surface: '#24202c',
      foreground: '#f8f5fb',
      accent: '#e3abd1',
      gradient: '#2e243d',
      decoration: 'LINES',
      motion: 'STILL',
    },
  },
  {
    name: 'یلدا',
    theme: {
      background: '#fff3f5',
      surface: '#ffffff',
      foreground: '#37111a',
      accent: '#871d3f',
      gradient: '#f3d5dc',
      decoration: 'DOTS',
      motion: 'STILL',
    },
  },
  {
    name: 'نوروز',
    theme: {
      background: '#eff7ed',
      surface: '#ffffff',
      foreground: '#16372c',
      accent: '#215342',
      gradient: '#d6e9db',
      decoration: 'DOTS',
      motion: 'STILL',
    },
  },
  {
    name: 'مناسبت ویژه',
    theme: {
      background: '#f6f3ee',
      surface: '#ffffff',
      foreground: '#2a2021',
      accent: '#69453f',
      gradient: '#f0e2df',
      decoration: 'NONE',
      motion: 'STILL',
    },
  },
];
type CampaignProducts = Awaited<ReturnType<typeof readCampaignProducts>>;
const sectionProductLimit = 12;
const sectionSampleSize = 48;
const campaignOrigin = 'https://campaign.invalid';

export function readFestivalDesign(value: Prisma.JsonValue | undefined) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.schemaVersion !== 1)
    return null;
  return value as unknown as FestivalDesignDto;
}

function assetIds(sections: FestivalSectionDto[]) {
  return [
    ...new Set(
      sections.flatMap(({ slides }) =>
        (slides ?? []).flatMap(({ mediaId, mobileMediaId, stillMediaId }) => [
          mediaId,
          ...(mobileMediaId ? [mobileMediaId] : []),
          ...(stillMediaId ? [stillMediaId] : []),
        ]),
      ),
    ),
  ];
}

function brightness(color: string) {
  const channels = color.slice(1).match(/../g) ?? [];
  const [red, green, blue] = channels.map((part) => {
    const value = Number.parseInt(part, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function checkTheme({ foreground, background, surface, gradient }: FestivalDesignDto['theme']) {
  const text = brightness(foreground) + 0.05;
  const canvases = [background, surface, gradient ?? background].map(
    (color) => brightness(color) + 0.05,
  );
  if (
    canvases.some((canvas) => Math.max(text, canvas) / Math.min(text, canvas) < 4.5) ||
    text > canvases[0] !== text > canvases[2]
  ) {
    throw new BadRequestException('Use a text color that contrasts with all festival backgrounds.');
  }
}

function normalizeDesign(input: FestivalDesignDto): FestivalDesignDto {
  return {
    schemaVersion: 1,
    theme: input.theme,
    sections: input.sections.map(({ slides, entries, ...section }) => ({
      ...section,
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
  checkTheme(design.theme);
  const products = design.sections.find(({ kind }) => kind === 'PRODUCTS');
  if (!products?.enabled || products.startsTehran || products.endsTehran)
    throw new BadRequestException('Keep the full product list enabled throughout the campaign.');

  for (const section of design.sections) {
    const { start, end } = sectionWindow(campaign, section);
    if (section.enabled && (start < campaign.startsAt || end > campaign.endsAt || end <= start))
      throw new BadRequestException('Keep section dates inside the campaign window.');
    if (section.slides?.length && section.kind !== 'HERO')
      throw new BadRequestException('Slides belong to the hero section.');
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
      this.db.festivalThemeTemplate.findMany({ orderBy: { name: 'asc' }, take: 100 }),
      this.assets(this.db, design?.sections ?? []),
    ]);
    return {
      revision: campaign.revision,
      design,
      presets: [
        ...presets,
        ...templates.map(({ name, theme }) => ({
          name,
          theme: theme as unknown as FestivalThemePresetDto['theme'],
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
        const { saveThemeAs: name } = input;
        if (presets.some((preset) => preset.name === name))
          throw new BadRequestException('Choose a new theme name.');
        const result = await tx.festivalThemeTemplate.createMany({
          data: [{ name, theme: JSON.parse(JSON.stringify(design.theme)) }],
          skipDuplicates: true,
        });
        if (result.count !== 1) throw new ConflictException('That theme name is already in use.');
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
    const sampleNeeded = sections.some(
      (section) =>
        ['DISCOUNTS', 'LOW_QUOTA', 'OFFERS'].includes(section.kind) && !section.slugs?.length,
    );
    const [assets, sample] = await Promise.all([
      this.assets(tx, sections),
      sampleNeeded || rebase
        ? readCampaignProducts(
            this.catalog,
            tx,
            campaign,
            landing,
            1,
            sampleNeeded ? sectionSampleSize : 0,
            {},
            { includeFilterOptions: true },
          )
        : products,
    ]);
    const byId = new Map(assets.map((asset) => [asset.id, asset]));
    const projected: PublicFestivalSectionDto[] = [];
    for (const section of sections) {
      const { kind, title, layout } = section;
      const view = { kind, title, layout };
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
        const facetSlugs = (sample.facets?.categories ?? []).map(({ value }) => value);
        const eligibleSlugs = new Set(facetSlugs);
        const slugs = (
          section.slugs?.length
            ? section.slugs.filter((slug) => eligibleSlugs.has(slug))
            : facetSlugs
        ).slice(0, sectionProductLimit);
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
        let eligible = sample.items;
        if (section.slugs?.length) {
          const rows = await tx.product.findMany({
            where: { slug: { in: section.slugs }, deletedAt: null, status: 'ACTIVE' },
            select: { slug: true, id: true },
          });
          const ids = new Map(rows.map(({ slug, id }) => [slug, id]));
          eligible = (
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
          ).items;
        } else if (kind === 'PICKS') {
          eligible = [];
        }
        const matching = eligible.filter(({ campaignOffer, campaignQuota }) => {
          if (kind === 'PICKS') return true;
          if (kind === 'LOW_QUOTA')
            return (
              campaignQuota?.campaignId === campaign.id &&
              campaignQuota.remaining > 0 &&
              campaignQuota.remaining <= (section.threshold ?? 3)
            );
          if (campaignOffer?.campaignId !== campaign.id) return false;
          return (
            kind === 'OFFERS' ||
            (campaignOffer.price?.discountPercent ?? 0) >= (section.threshold ?? 10)
          );
        });
        projected.push({
          ...view,
          products: matching.slice(0, sectionProductLimit),
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
      filterCategories: sample.facets?.categories ?? [],
      filterBrands: sample.facets?.brands ?? [],
      ...(nextChange !== null ? { refreshAt: new Date(nextChange).toISOString() } : {}),
    };
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
