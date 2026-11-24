import { Body, Controller, Get, Param, ParseUUIDPipe, Put, Query } from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';
import { CurrentPrincipal } from '../auth/current-principal.decorator';
import type { AuthenticatedPrincipal } from '../authorization/authorization.types';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { PERMISSION_CODES } from '../authorization/rbac.constants';
import { CampaignQuotasService } from './campaign-quotas.service';
import {
  CampaignQuotaAdminDto,
  CampaignQuotaProductDto,
  SaveCampaignQuotaDto,
} from './dto/campaign-quota.dto';

@Controller({ path: 'campaigns', version: '1' })
export class CampaignQuotasController {
  constructor(private readonly quotas: CampaignQuotasService) {}

  @Get(':id/quota')
  @RequirePermissions(PERMISSION_CODES.SETTINGS_READ)
  @ApiOkResponse({ type: CampaignQuotaAdminDto })
  get(@Param('id', ParseUUIDPipe) id: string, @Query() query: CampaignQuotaProductDto) {
    return this.quotas.get(id, query.slug);
  }

  @Put(':id/quota')
  @RequirePermissions(PERMISSION_CODES.SETTINGS_WRITE)
  @ApiOkResponse({ type: CampaignQuotaAdminDto })
  save(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: SaveCampaignQuotaDto,
    @CurrentPrincipal() actor: AuthenticatedPrincipal,
  ) {
    return this.quotas.save(id, input, actor.userId);
  }
}
