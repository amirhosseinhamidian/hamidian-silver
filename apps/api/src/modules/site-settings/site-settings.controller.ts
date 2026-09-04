import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';

import { CurrentPrincipal } from '../auth/current-principal.decorator';
import { Public } from '../auth/public.decorator';
import type { AuthenticatedPrincipal } from '../authorization/authorization.types';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { PERMISSION_CODES } from '../authorization/rbac.constants';
import { AdminSiteSettingsDto } from './dto/admin-site-settings.dto';
import { PublicSiteSettingsDto } from './dto/public-site-settings.dto';
import { UpdateSiteSettingsDto } from './dto/update-site-settings.dto';
import { SiteSettingsService } from './site-settings.service';

@Controller({
  path: 'site-settings',
  version: '1',
})
export class SiteSettingsController {
  constructor(private readonly siteSettingsService: SiteSettingsService) {}

  @Public()
  @Get('public')
  @ApiOkResponse({ type: PublicSiteSettingsDto })
  getPublicSettings(): Promise<PublicSiteSettingsDto> {
    return this.siteSettingsService.getPublicSettings();
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
