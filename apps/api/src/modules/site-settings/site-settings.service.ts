import { BadRequestException, Injectable } from '@nestjs/common';

import { PrismaService } from '../../infrastructure/database/prisma.service';
import { PublicMediaUrlService } from '../catalog/public-media-url.service';
import { AdminSiteSettingsDto } from './dto/admin-site-settings.dto';
import {
  PublicSiteAnnouncementDto,
  PublicSiteSettingsDto,
  PublicSiteSettingsHeaderCategoryDto,
  PublicSiteSettingsMediaDto,
} from './dto/public-site-settings.dto';
import { UpdateSiteSettingsDto } from './dto/update-site-settings.dto';

const SITE_SETTINGS_ID = 'site';
const DEFAULT_SEO_SITE_NAME = 'نقره حمیدیان';
const DEFAULT_SEO_TITLE = 'نقره حمیدیان';
const DEFAULT_SEO_TITLE_TEMPLATE = '%s | نقره حمیدیان';
const DEFAULT_SEO_DESCRIPTION = 'فروشگاه آنلاین و گالری نقره حمیدیان';

type SiteSettingsMedia = Readonly<{
  storageKey: string;
  altText: string | null;
  deletedAt: Date | null;
}>;

type SiteSettingsRecord = Readonly<{
  headerCategoryIds: string[];
  announcementEnabled: boolean;
  announcementMessage: string | null;
  announcementCountdownMode: string;
  announcementDurationSeconds: number | null;
  announcementEndsAt: Date | null;
  announcementCtaLabel: string | null;
  announcementCtaHref: string | null;
  catalogHeroEnabled: boolean;
  catalogHeroTitle: string | null;
  catalogHeroSubtitle: string | null;
  catalogHeroMediaId: string | null;
  galleryName: string | null;
  footerAbout: string | null;
  contactAddress: string | null;
  contactPhoneNumbers: string[];
  contactEmail: string | null;
  instagramUrl: string | null;
  telegramUrl: string | null;
  baleUrl: string | null;
  seoSiteName: string;
  seoDefaultTitle: string;
  seoTitleTemplate: string;
  seoDefaultDescription: string;
  seoDefaultOgMediaId: string | null;
  seoOrganizationName: string;
  seoOrganizationLogoMediaId: string | null;
  seoSocialProfileUrls: string[];
  seoHomeTitle: string | null;
  seoHomeDescription: string | null;
  seoHomeOgMediaId: string | null;
  updatedByUserId: string | null;
  updatedAt: Date;
  catalogHeroMedia: SiteSettingsMedia | null;
  seoDefaultOgMedia: SiteSettingsMedia | null;
  seoOrganizationLogoMedia: SiteSettingsMedia | null;
  seoHomeOgMedia: SiteSettingsMedia | null;
}>;

type AnnouncementSettings = Readonly<{
  enabled: boolean;
  message: string | null;
  countdownMode: 'NONE' | 'FIXED' | 'DEADLINE';
  durationSeconds: number | null;
  endsAt: Date | null;
  ctaLabel: string | null;
  ctaHref: string | null;
}>;

function normalizeNullableText(value: string | null | undefined): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalized = value?.trim();

  return normalized || null;
}

function normalizeStringArray(values: string[] | undefined): string[] | undefined {
  return values?.map((value) => value.trim()).filter(Boolean);
}

function resolveNullableText(
  value: string | null | undefined,
  current: string | null | undefined,
): string | null {
  const normalized = normalizeNullableText(value);
  return normalized === undefined ? (current ?? null) : normalized;
}

@Injectable()
export class SiteSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly publicMediaUrlService: PublicMediaUrlService,
  ) {}

  async getPublicSettings(): Promise<PublicSiteSettingsDto> {
    const settings = await this.findSettings();

    if (!settings) {
      return this.defaultPublicSettings();
    }

    return {
      headerCategories: await this.projectHeaderCategories(settings.headerCategoryIds),
      announcement: this.projectAnnouncement(settings),
      catalogHeroEnabled: settings.catalogHeroEnabled,
      catalogHeroTitle: settings.catalogHeroTitle,
      catalogHeroSubtitle: settings.catalogHeroSubtitle,
      catalogHeroMedia: this.projectPublicMedia(settings.catalogHeroMedia),
      galleryName: settings.galleryName,
      footerAbout: settings.footerAbout,
      contactAddress: settings.contactAddress,
      contactPhoneNumbers: settings.contactPhoneNumbers,
      contactEmail: settings.contactEmail,
      instagramUrl: settings.instagramUrl,
      telegramUrl: settings.telegramUrl,
      baleUrl: settings.baleUrl,
      seoSiteName: settings.seoSiteName,
      seoDefaultTitle: settings.seoDefaultTitle,
      seoTitleTemplate: settings.seoTitleTemplate,
      seoDefaultDescription: settings.seoDefaultDescription,
      seoDefaultOgMedia: this.projectPublicMedia(settings.seoDefaultOgMedia),
      seoOrganizationName: settings.seoOrganizationName,
      seoOrganizationLogoMedia: this.projectPublicMedia(settings.seoOrganizationLogoMedia),
      seoSocialProfileUrls: settings.seoSocialProfileUrls,
      seoHomeTitle: settings.seoHomeTitle,
      seoHomeDescription: settings.seoHomeDescription,
      seoHomeOgMedia: this.projectPublicMedia(settings.seoHomeOgMedia),
    };
  }

  async getAdminSettings(): Promise<AdminSiteSettingsDto> {
    const settings = await this.findSettings();

    if (!settings) {
      const defaults = this.defaultPublicSettings();
      return {
        headerCategoryIds: [],
        announcement: defaults.announcement,
        catalogHeroEnabled: defaults.catalogHeroEnabled,
        catalogHeroTitle: defaults.catalogHeroTitle,
        catalogHeroSubtitle: defaults.catalogHeroSubtitle,
        catalogHeroMedia: defaults.catalogHeroMedia,
        galleryName: defaults.galleryName,
        footerAbout: defaults.footerAbout,
        contactAddress: defaults.contactAddress,
        contactPhoneNumbers: defaults.contactPhoneNumbers,
        contactEmail: defaults.contactEmail,
        instagramUrl: defaults.instagramUrl,
        telegramUrl: defaults.telegramUrl,
        baleUrl: defaults.baleUrl,
        seoSiteName: defaults.seoSiteName,
        seoDefaultTitle: defaults.seoDefaultTitle,
        seoTitleTemplate: defaults.seoTitleTemplate,
        seoDefaultDescription: defaults.seoDefaultDescription,
        seoDefaultOgMediaId: null,
        seoDefaultOgMedia: defaults.seoDefaultOgMedia,
        seoOrganizationName: defaults.seoOrganizationName,
        seoOrganizationLogoMediaId: null,
        seoOrganizationLogoMedia: defaults.seoOrganizationLogoMedia,
        seoSocialProfileUrls: defaults.seoSocialProfileUrls,
        seoHomeTitle: defaults.seoHomeTitle,
        seoHomeDescription: defaults.seoHomeDescription,
        seoHomeOgMediaId: null,
        seoHomeOgMedia: defaults.seoHomeOgMedia,
        catalogHeroMediaId: null,
        updatedByUserId: null,
        updatedAt: null,
      };
    }

    return this.projectAdminSettings(settings);
  }

  async updateSettings(
    dto: UpdateSiteSettingsDto,
    actorUserId: string,
  ): Promise<AdminSiteSettingsDto> {
    const current = await this.prisma.siteSettings.findUnique({
      where: { id: SITE_SETTINGS_ID },
      select: {
        headerCategoryIds: true,
        announcementEnabled: true,
        announcementMessage: true,
        announcementCountdownMode: true,
        announcementDurationSeconds: true,
        announcementEndsAt: true,
        announcementCtaLabel: true,
        announcementCtaHref: true,
        catalogHeroEnabled: true,
        catalogHeroTitle: true,
        catalogHeroSubtitle: true,
        catalogHeroMediaId: true,
        galleryName: true,
        footerAbout: true,
        contactAddress: true,
        contactPhoneNumbers: true,
        contactEmail: true,
        instagramUrl: true,
        telegramUrl: true,
        baleUrl: true,
        seoSiteName: true,
        seoDefaultTitle: true,
        seoTitleTemplate: true,
        seoDefaultDescription: true,
        seoDefaultOgMediaId: true,
        seoOrganizationName: true,
        seoOrganizationLogoMediaId: true,
        seoSocialProfileUrls: true,
        seoHomeTitle: true,
        seoHomeDescription: true,
        seoHomeOgMediaId: true,
      },
    });

    const headerCategoryIds = dto.headerCategoryIds ?? current?.headerCategoryIds ?? [];
    const announcement = this.resolveAnnouncement(dto, current);

    const catalogHeroEnabled = dto.catalogHeroEnabled ?? current?.catalogHeroEnabled ?? false;
    const normalizedCatalogHeroTitle = normalizeNullableText(dto.catalogHeroTitle);
    const normalizedCatalogHeroSubtitle = normalizeNullableText(dto.catalogHeroSubtitle);
    const catalogHeroTitle =
      normalizedCatalogHeroTitle !== undefined
        ? normalizedCatalogHeroTitle
        : (current?.catalogHeroTitle ?? null);
    const catalogHeroSubtitle =
      normalizedCatalogHeroSubtitle !== undefined
        ? normalizedCatalogHeroSubtitle
        : (current?.catalogHeroSubtitle ?? null);
    const catalogHeroMediaId =
      dto.catalogHeroMediaId !== undefined
        ? dto.catalogHeroMediaId
        : (current?.catalogHeroMediaId ?? null);
    const galleryName = resolveNullableText(dto.galleryName, current?.galleryName);
    const footerAbout = resolveNullableText(dto.footerAbout, current?.footerAbout);
    const contactAddress = resolveNullableText(dto.contactAddress, current?.contactAddress);
    const contactPhoneNumbers =
      normalizeStringArray(dto.contactPhoneNumbers) ?? current?.contactPhoneNumbers ?? [];
    const contactEmail = resolveNullableText(dto.contactEmail, current?.contactEmail);
    const instagramUrl = resolveNullableText(dto.instagramUrl, current?.instagramUrl);
    const telegramUrl = resolveNullableText(dto.telegramUrl, current?.telegramUrl);
    const baleUrl = resolveNullableText(dto.baleUrl, current?.baleUrl);
    const seoSiteName = dto.seoSiteName?.trim() || current?.seoSiteName || DEFAULT_SEO_SITE_NAME;
    const seoDefaultTitle =
      dto.seoDefaultTitle?.trim() || current?.seoDefaultTitle || DEFAULT_SEO_TITLE;
    const seoTitleTemplate =
      dto.seoTitleTemplate?.trim() || current?.seoTitleTemplate || DEFAULT_SEO_TITLE_TEMPLATE;
    const seoDefaultDescription =
      dto.seoDefaultDescription?.trim() ||
      current?.seoDefaultDescription ||
      DEFAULT_SEO_DESCRIPTION;
    const seoDefaultOgMediaId =
      dto.seoDefaultOgMediaId === undefined
        ? (current?.seoDefaultOgMediaId ?? null)
        : dto.seoDefaultOgMediaId;
    const seoOrganizationName =
      dto.seoOrganizationName?.trim() || current?.seoOrganizationName || seoSiteName;
    const seoOrganizationLogoMediaId =
      dto.seoOrganizationLogoMediaId === undefined
        ? (current?.seoOrganizationLogoMediaId ?? null)
        : dto.seoOrganizationLogoMediaId;
    const seoSocialProfileUrls =
      normalizeStringArray(dto.seoSocialProfileUrls) ?? current?.seoSocialProfileUrls ?? [];
    const seoHomeTitle = resolveNullableText(dto.seoHomeTitle, current?.seoHomeTitle);
    const seoHomeDescription = resolveNullableText(
      dto.seoHomeDescription,
      current?.seoHomeDescription,
    );
    const seoHomeOgMediaId =
      dto.seoHomeOgMediaId === undefined
        ? (current?.seoHomeOgMediaId ?? null)
        : dto.seoHomeOgMediaId;

    await Promise.all([
      this.validateCatalogHeroMedia(catalogHeroEnabled, catalogHeroMediaId, dto),
      this.validateHeaderCategories(headerCategoryIds),
      this.validateSeoMediaIds([seoDefaultOgMediaId, seoOrganizationLogoMediaId, seoHomeOgMediaId]),
    ]);
    this.validateAnnouncement(announcement);
    this.validateSeoTitleTemplate(seoTitleTemplate);

    const settings = await this.prisma.siteSettings.upsert({
      where: { id: SITE_SETTINGS_ID },
      create: {
        id: SITE_SETTINGS_ID,
        headerCategoryIds,
        announcementEnabled: announcement.enabled,
        announcementMessage: announcement.message,
        announcementCountdownMode: announcement.countdownMode,
        announcementDurationSeconds: announcement.durationSeconds,
        announcementEndsAt: announcement.endsAt,
        announcementCtaLabel: announcement.ctaLabel,
        announcementCtaHref: announcement.ctaHref,
        catalogHeroEnabled,
        catalogHeroTitle,
        catalogHeroSubtitle,
        catalogHeroMediaId,
        galleryName,
        footerAbout,
        contactAddress,
        contactPhoneNumbers,
        contactEmail,
        instagramUrl,
        telegramUrl,
        baleUrl,
        seoSiteName,
        seoDefaultTitle,
        seoTitleTemplate,
        seoDefaultDescription,
        seoDefaultOgMediaId,
        seoOrganizationName,
        seoOrganizationLogoMediaId,
        seoSocialProfileUrls,
        seoHomeTitle,
        seoHomeDescription,
        seoHomeOgMediaId,
        updatedByUserId: actorUserId,
      },
      update: {
        headerCategoryIds,
        announcementEnabled: announcement.enabled,
        announcementMessage: announcement.message,
        announcementCountdownMode: announcement.countdownMode,
        announcementDurationSeconds: announcement.durationSeconds,
        announcementEndsAt: announcement.endsAt,
        announcementCtaLabel: announcement.ctaLabel,
        announcementCtaHref: announcement.ctaHref,
        catalogHeroEnabled,
        catalogHeroTitle,
        catalogHeroSubtitle,
        catalogHeroMediaId,
        galleryName,
        footerAbout,
        contactAddress,
        contactPhoneNumbers,
        contactEmail,
        instagramUrl,
        telegramUrl,
        baleUrl,
        seoSiteName,
        seoDefaultTitle,
        seoTitleTemplate,
        seoDefaultDescription,
        seoDefaultOgMediaId,
        seoOrganizationName,
        seoOrganizationLogoMediaId,
        seoSocialProfileUrls,
        seoHomeTitle,
        seoHomeDescription,
        seoHomeOgMediaId,
        updatedByUserId: actorUserId,
      },
      include: {
        catalogHeroMedia: true,
        seoDefaultOgMedia: true,
        seoOrganizationLogoMedia: true,
        seoHomeOgMedia: true,
      },
    });

    return this.projectAdminSettings(settings);
  }

  private findSettings(): Promise<SiteSettingsRecord | null> {
    return this.prisma.siteSettings.findUnique({
      where: { id: SITE_SETTINGS_ID },
      include: {
        catalogHeroMedia: true,
        seoDefaultOgMedia: true,
        seoOrganizationLogoMedia: true,
        seoHomeOgMedia: true,
      },
    });
  }

  private resolveAnnouncement(
    dto: UpdateSiteSettingsDto,
    current: Readonly<{
      announcementEnabled: boolean;
      announcementMessage: string | null;
      announcementCountdownMode: string;
      announcementDurationSeconds: number | null;
      announcementEndsAt: Date | null;
      announcementCtaLabel: string | null;
      announcementCtaHref: string | null;
    }> | null,
  ): AnnouncementSettings {
    const update = dto.announcement;
    const candidateMode = update?.countdownMode ?? current?.announcementCountdownMode ?? 'NONE';
    const countdownMode = ['NONE', 'FIXED', 'DEADLINE'].includes(candidateMode)
      ? (candidateMode as AnnouncementSettings['countdownMode'])
      : 'NONE';
    const endsAtValue = update?.endsAt;
    const endsAt =
      countdownMode === 'DEADLINE'
        ? endsAtValue === undefined
          ? (current?.announcementEndsAt ?? null)
          : endsAtValue
            ? new Date(endsAtValue)
            : null
        : null;

    return {
      enabled: update?.enabled ?? current?.announcementEnabled ?? false,
      message: resolveNullableText(update?.message, current?.announcementMessage),
      countdownMode,
      durationSeconds:
        countdownMode === 'FIXED'
          ? (update?.durationSeconds ?? current?.announcementDurationSeconds ?? null)
          : null,
      endsAt,
      ctaLabel: resolveNullableText(update?.ctaLabel, current?.announcementCtaLabel),
      ctaHref: resolveNullableText(update?.ctaHref, current?.announcementCtaHref),
    };
  }

  private validateAnnouncement(announcement: AnnouncementSettings): void {
    if (announcement.enabled && !announcement.message) {
      throw new BadRequestException('Announcement message is required when it is enabled.');
    }
    if (
      announcement.countdownMode === 'FIXED' &&
      (announcement.durationSeconds === null ||
        announcement.durationSeconds < 60 ||
        announcement.durationSeconds > 604800)
    ) {
      throw new BadRequestException('Announcement duration must be between 60 and 604800 seconds.');
    }
    if (announcement.countdownMode === 'DEADLINE' && !announcement.endsAt) {
      throw new BadRequestException('Announcement end date is required for deadline countdown.');
    }
    if (Boolean(announcement.ctaLabel) !== Boolean(announcement.ctaHref)) {
      throw new BadRequestException(
        'Announcement action label and link must be provided together.',
      );
    }
    if (announcement.ctaHref && !this.isAllowedActionHref(announcement.ctaHref)) {
      throw new BadRequestException(
        'Announcement action link must be an internal path or HTTP URL.',
      );
    }
  }

  private async validateHeaderCategories(categoryIds: string[]): Promise<void> {
    if (new Set(categoryIds).size !== categoryIds.length) {
      throw new BadRequestException('Header categories must be unique.');
    }
    if (categoryIds.length === 0) return;

    const count = await this.prisma.category.count({
      where: { id: { in: categoryIds }, isActive: true, deletedAt: null },
    });
    if (count !== categoryIds.length) {
      throw new BadRequestException('Header categories must reference active categories.');
    }
  }

  private validateSeoTitleTemplate(template: string): void {
    if (template.split('%s').length !== 2) {
      throw new BadRequestException('SEO title template must contain exactly one %s placeholder.');
    }
  }

  private async validateSeoMediaIds(mediaIds: Array<string | null>): Promise<void> {
    const uniqueIds = [...new Set(mediaIds.filter((id): id is string => Boolean(id)))];
    if (uniqueIds.length === 0) return;
    const count = await this.prisma.media.count({
      where: {
        id: { in: uniqueIds },
        deletedAt: null,
        mimeType: { startsWith: 'image/' },
      },
    });
    if (count !== uniqueIds.length) {
      throw new BadRequestException('SEO media must reference active images.');
    }
  }

  private async projectHeaderCategories(
    categoryIds: string[],
  ): Promise<PublicSiteSettingsHeaderCategoryDto[]> {
    if (categoryIds.length === 0) return [];
    const categories = await this.prisma.category.findMany({
      where: { id: { in: categoryIds }, isActive: true, deletedAt: null },
      select: { id: true, name: true, slug: true },
    });
    const byId = new Map(categories.map((category) => [category.id, category] as const));
    return categoryIds.flatMap((categoryId) => {
      const category = byId.get(categoryId);
      return category ? [{ id: category.id, label: category.name, slug: category.slug }] : [];
    });
  }

  private projectAnnouncement(settings: {
    announcementEnabled: boolean;
    announcementMessage: string | null;
    announcementCountdownMode: string;
    announcementDurationSeconds: number | null;
    announcementEndsAt: Date | null;
    announcementCtaLabel: string | null;
    announcementCtaHref: string | null;
  }): PublicSiteAnnouncementDto {
    const mode = ['NONE', 'FIXED', 'DEADLINE'].includes(settings.announcementCountdownMode)
      ? (settings.announcementCountdownMode as PublicSiteAnnouncementDto['countdownMode'])
      : 'NONE';
    return {
      enabled: settings.announcementEnabled,
      message: settings.announcementMessage,
      countdownMode: mode,
      durationSeconds: mode === 'FIXED' ? settings.announcementDurationSeconds : null,
      endsAt:
        mode === 'DEADLINE' && settings.announcementEndsAt
          ? settings.announcementEndsAt.toISOString()
          : null,
      ctaLabel: settings.announcementCtaLabel,
      ctaHref: settings.announcementCtaHref,
    };
  }

  private isAllowedActionHref(href: string): boolean {
    if (href.startsWith('/') && !href.startsWith('//')) return true;
    try {
      const url = new URL(href);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }

  private async validateCatalogHeroMedia(
    enabled: boolean,
    mediaId: string | null,
    dto: UpdateSiteSettingsDto,
  ): Promise<void> {
    if (enabled && !mediaId) {
      throw new BadRequestException('Catalog hero image is required when the hero is enabled.');
    }

    if (!mediaId || (dto.catalogHeroMediaId === undefined && !enabled)) {
      return;
    }

    const media = await this.prisma.media.findFirst({
      where: {
        id: mediaId,
        deletedAt: null,
      },
      select: {
        mimeType: true,
      },
    });

    if (!media || !media.mimeType.startsWith('image/')) {
      throw new BadRequestException('Catalog hero media must reference an active image.');
    }
  }

  private defaultPublicSettings(): PublicSiteSettingsDto {
    return {
      headerCategories: [],
      announcement: {
        enabled: false,
        message: null,
        countdownMode: 'NONE',
        durationSeconds: null,
        endsAt: null,
        ctaLabel: null,
        ctaHref: null,
      },
      catalogHeroEnabled: false,
      catalogHeroTitle: null,
      catalogHeroSubtitle: null,
      catalogHeroMedia: null,
      galleryName: null,
      footerAbout: null,
      contactAddress: null,
      contactPhoneNumbers: [],
      contactEmail: null,
      instagramUrl: null,
      telegramUrl: null,
      baleUrl: null,
      seoSiteName: DEFAULT_SEO_SITE_NAME,
      seoDefaultTitle: DEFAULT_SEO_TITLE,
      seoTitleTemplate: DEFAULT_SEO_TITLE_TEMPLATE,
      seoDefaultDescription: DEFAULT_SEO_DESCRIPTION,
      seoDefaultOgMedia: null,
      seoOrganizationName: DEFAULT_SEO_SITE_NAME,
      seoOrganizationLogoMedia: null,
      seoSocialProfileUrls: [],
      seoHomeTitle: null,
      seoHomeDescription: null,
      seoHomeOgMedia: null,
    };
  }

  private projectAdminSettings(settings: SiteSettingsRecord): AdminSiteSettingsDto {
    return {
      headerCategoryIds: settings.headerCategoryIds,
      announcement: this.projectAnnouncement(settings),
      catalogHeroEnabled: settings.catalogHeroEnabled,
      catalogHeroTitle: settings.catalogHeroTitle,
      catalogHeroSubtitle: settings.catalogHeroSubtitle,
      catalogHeroMediaId: settings.catalogHeroMediaId,
      catalogHeroMedia: this.projectPublicMedia(settings.catalogHeroMedia),
      galleryName: settings.galleryName,
      footerAbout: settings.footerAbout,
      contactAddress: settings.contactAddress,
      contactPhoneNumbers: settings.contactPhoneNumbers,
      contactEmail: settings.contactEmail,
      instagramUrl: settings.instagramUrl,
      telegramUrl: settings.telegramUrl,
      baleUrl: settings.baleUrl,
      seoSiteName: settings.seoSiteName,
      seoDefaultTitle: settings.seoDefaultTitle,
      seoTitleTemplate: settings.seoTitleTemplate,
      seoDefaultDescription: settings.seoDefaultDescription,
      seoDefaultOgMediaId: settings.seoDefaultOgMediaId,
      seoDefaultOgMedia: this.projectPublicMedia(settings.seoDefaultOgMedia),
      seoOrganizationName: settings.seoOrganizationName,
      seoOrganizationLogoMediaId: settings.seoOrganizationLogoMediaId,
      seoOrganizationLogoMedia: this.projectPublicMedia(settings.seoOrganizationLogoMedia),
      seoSocialProfileUrls: settings.seoSocialProfileUrls,
      seoHomeTitle: settings.seoHomeTitle,
      seoHomeDescription: settings.seoHomeDescription,
      seoHomeOgMediaId: settings.seoHomeOgMediaId,
      seoHomeOgMedia: this.projectPublicMedia(settings.seoHomeOgMedia),
      updatedByUserId: settings.updatedByUserId,
      updatedAt: settings.updatedAt.toISOString(),
    };
  }

  private projectPublicMedia(media: SiteSettingsMedia | null): PublicSiteSettingsMediaDto | null {
    if (!media || media.deletedAt) {
      return null;
    }

    return {
      url: this.publicMediaUrlService.resolve(media.storageKey),
      altText: media.altText,
    };
  }
}
