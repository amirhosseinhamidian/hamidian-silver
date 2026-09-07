import { BadRequestException, Injectable } from '@nestjs/common';

import { PrismaService } from '../../infrastructure/database/prisma.service';
import { PublicMediaUrlService } from '../catalog/public-media-url.service';
import { AdminSiteSettingsDto } from './dto/admin-site-settings.dto';
import { PublicSiteSettingsDto, PublicSiteSettingsMediaDto } from './dto/public-site-settings.dto';
import { UpdateSiteSettingsDto } from './dto/update-site-settings.dto';

const SITE_SETTINGS_ID = 'site';

type SiteSettingsMedia = Readonly<{
  storageKey: string;
  altText: string | null;
  deletedAt: Date | null;
}>;

type SiteSettingsRecord = Readonly<{
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
  updatedByUserId: string | null;
  updatedAt: Date;
  catalogHeroMedia: SiteSettingsMedia | null;
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
    };
  }

  async getAdminSettings(): Promise<AdminSiteSettingsDto> {
    const settings = await this.findSettings();

    if (!settings) {
      return {
        ...this.defaultPublicSettings(),
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
      },
    });

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

    await this.validateCatalogHeroMedia(catalogHeroEnabled, catalogHeroMediaId, dto);

    const settings = await this.prisma.siteSettings.upsert({
      where: { id: SITE_SETTINGS_ID },
      create: {
        id: SITE_SETTINGS_ID,
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
        updatedByUserId: actorUserId,
      },
      update: {
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
        updatedByUserId: actorUserId,
      },
      include: {
        catalogHeroMedia: true,
      },
    });

    return this.projectAdminSettings(settings);
  }

  private findSettings(): Promise<SiteSettingsRecord | null> {
    return this.prisma.siteSettings.findUnique({
      where: { id: SITE_SETTINGS_ID },
      include: {
        catalogHeroMedia: true,
      },
    });
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
    };
  }

  private projectAdminSettings(settings: SiteSettingsRecord): AdminSiteSettingsDto {
    return {
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
