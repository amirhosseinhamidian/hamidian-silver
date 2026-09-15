import {
  Body,
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  Patch,
  Post,
  Put,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOkResponse, ApiParam } from '@nestjs/swagger';

import { MEDIA_UPLOAD_LIMIT_BYTES } from '../../config/media-storage';
import { StorefrontContentPageKey } from '../../generated/prisma/enums';
import { CurrentPrincipal } from '../auth/current-principal.decorator';
import { Public } from '../auth/public.decorator';
import type { AuthenticatedPrincipal } from '../authorization/authorization.types';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { PERMISSION_CODES } from '../authorization/rbac.constants';
import { CatalogMediaService } from '../catalog/catalog-media.service';
import type { CatalogUploadFile } from '../catalog/local-media-storage.service';
import { PublicMediaUrlService } from '../catalog/public-media-url.service';
import { UploadMediaDto } from '../catalog/dto/upload-media.dto';
import { AdminSiteMediaDto } from './dto/admin-site-media.dto';
import { AdminSiteSettingsDto } from './dto/admin-site-settings.dto';
import { AdminHomepageDto } from './dto/admin-homepage.dto';
import { AdminContentPageDto } from './dto/admin-content-page.dto';
import { PublicContentPageDto } from './dto/public-content-page.dto';
import { PublicHomepageDto } from './dto/public-homepage.dto';
import { PublicSiteSettingsDto } from './dto/public-site-settings.dto';
import { UpdateSiteSettingsDto } from './dto/update-site-settings.dto';
import { UpdateHomepageDto } from './dto/update-homepage.dto';
import { UpdateContentPageDto } from './dto/update-content-page.dto';
import { ContentPagesService } from './content-pages.service';
import { HomepageService } from './homepage.service';
import { SiteSettingsService } from './site-settings.service';

@Controller({
  path: 'site-settings',
  version: '1',
})
export class SiteSettingsController {
  constructor(
    private readonly siteSettingsService: SiteSettingsService,
    private readonly homepageService: HomepageService,
    private readonly contentPagesService: ContentPagesService,
    private readonly catalogMediaService: CatalogMediaService,
    private readonly publicMediaUrlService: PublicMediaUrlService,
  ) {}

  @Post('media')
  @RequirePermissions(PERMISSION_CODES.SETTINGS_WRITE)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MEDIA_UPLOAD_LIMIT_BYTES, files: 1 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
        altText: { type: 'string', minLength: 1, maxLength: 255 },
      },
    },
  })
  @ApiOkResponse({ type: AdminSiteMediaDto })
  async uploadSiteMedia(
    @UploadedFile() file: CatalogUploadFile | undefined,
    @Body() dto: UploadMediaDto,
  ): Promise<AdminSiteMediaDto> {
    const media = await this.catalogMediaService.upload(file, dto);
    return {
      id: media.id,
      url: this.publicMediaUrlService.resolve(media.storageKey),
      mimeType: media.mimeType,
      altText: media.altText,
    };
  }

  @Post('pages/media')
  @RequirePermissions(PERMISSION_CODES.CMS_WRITE)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MEDIA_UPLOAD_LIMIT_BYTES, files: 1 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
        altText: { type: 'string', minLength: 1, maxLength: 255 },
      },
    },
  })
  @ApiOkResponse({ type: AdminSiteMediaDto })
  async uploadContentPageMedia(
    @UploadedFile() file: CatalogUploadFile | undefined,
    @Body() dto: UploadMediaDto,
  ): Promise<AdminSiteMediaDto> {
    const media = await this.catalogMediaService.upload(file, dto);
    return {
      id: media.id,
      url: this.publicMediaUrlService.resolve(media.storageKey),
      mimeType: media.mimeType,
      altText: media.altText,
    };
  }

  @Public()
  @Get('public')
  @ApiOkResponse({ type: PublicSiteSettingsDto })
  getPublicSettings(): Promise<PublicSiteSettingsDto> {
    return this.siteSettingsService.getPublicSettings();
  }

  @Public()
  @Get('public/homepage')
  @ApiOkResponse({ type: PublicHomepageDto })
  getPublicHomepage(): Promise<PublicHomepageDto> {
    return this.homepageService.getPublicHomepage();
  }

  @Public()
  @Get('public/pages/:key')
  @ApiParam({ name: 'key', enum: StorefrontContentPageKey })
  @ApiOkResponse({ type: PublicContentPageDto })
  getPublicContentPage(
    @Param('key', new ParseEnumPipe(StorefrontContentPageKey)) key: StorefrontContentPageKey,
  ): Promise<PublicContentPageDto> {
    return this.contentPagesService.getPublicPage(key);
  }

  @Get('pages')
  @RequirePermissions(PERMISSION_CODES.CMS_READ)
  @ApiOkResponse({ type: AdminContentPageDto, isArray: true })
  getAdminContentPages(): Promise<AdminContentPageDto[]> {
    return this.contentPagesService.getAdminPages();
  }

  @Put('pages/:key')
  @RequirePermissions(PERMISSION_CODES.CMS_WRITE)
  @ApiParam({ name: 'key', enum: StorefrontContentPageKey })
  @ApiOkResponse({ type: AdminContentPageDto })
  updateContentPage(
    @Param('key', new ParseEnumPipe(StorefrontContentPageKey)) key: StorefrontContentPageKey,
    @Body() dto: UpdateContentPageDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<AdminContentPageDto> {
    return this.contentPagesService.updatePage(key, dto, principal.userId);
  }

  @Get('homepage')
  @RequirePermissions(PERMISSION_CODES.SETTINGS_READ)
  @ApiOkResponse({ type: AdminHomepageDto })
  getAdminHomepage(): Promise<AdminHomepageDto> {
    return this.homepageService.getAdminHomepage();
  }

  @Put('homepage')
  @RequirePermissions(PERMISSION_CODES.SETTINGS_WRITE)
  @ApiOkResponse({ type: AdminHomepageDto })
  updateHomepage(
    @Body() dto: UpdateHomepageDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<AdminHomepageDto> {
    return this.homepageService.updateHomepage(dto, principal.userId);
  }

  @Get()
  @RequirePermissions(PERMISSION_CODES.SETTINGS_READ)
  @ApiOkResponse({ type: AdminSiteSettingsDto })
  getAdminSettings(): Promise<AdminSiteSettingsDto> {
    return this.siteSettingsService.getAdminSettings();
  }

  @Patch()
  @RequirePermissions(PERMISSION_CODES.SETTINGS_WRITE)
  @ApiOkResponse({ type: AdminSiteSettingsDto })
  updateSettings(
    @Body() dto: UpdateSiteSettingsDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<AdminSiteSettingsDto> {
    return this.siteSettingsService.updateSettings(dto, principal.userId);
  }
}
