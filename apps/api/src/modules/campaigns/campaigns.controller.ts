import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse } from '@nestjs/swagger';
import { CurrentPrincipal } from '../auth/current-principal.decorator';
import { Public } from '../auth/public.decorator';
import type { AuthenticatedPrincipal } from '../authorization/authorization.types';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { PERMISSION_CODES } from '../authorization/rbac.constants';
import { CampaignsService } from './campaigns.service';
import {
  CampaignDetailDto,
  CampaignListDto,
  CampaignPageQueryDto,
  CampaignSummaryDto,
  CampaignTransitionDto,
  CreateCampaignDto,
  PublicCampaignDto,
  UpdateCampaignDto,
} from './dto/campaign.dto';

@Controller({ path: 'campaigns', version: '1' })
export class CampaignsController {
  constructor(private readonly campaigns: CampaignsService) {}

  @Get('public/banner')
  @Public()
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: PublicCampaignDto })
  publicBanner(): Promise<PublicCampaignDto> {
    return this.campaigns.publicBanner();
  }

  @Get()
  @RequirePermissions(PERMISSION_CODES.SETTINGS_READ)
  @ApiOkResponse({ type: CampaignListDto })
  list(@Query() query: CampaignPageQueryDto): Promise<CampaignListDto> {
    return this.campaigns.list(query.page ?? 1);
  }

  @Get(':id')
  @RequirePermissions(PERMISSION_CODES.SETTINGS_READ)
  @ApiOkResponse({ type: CampaignDetailDto })
  detail(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: CampaignPageQueryDto,
  ): Promise<CampaignDetailDto> {
    return this.campaigns.detail(id, query.page ?? 1);
  }

  @Post()
  @RequirePermissions(PERMISSION_CODES.SETTINGS_WRITE)
  @ApiCreatedResponse({ type: CampaignSummaryDto })
  create(
    @Body() input: CreateCampaignDto,
    @CurrentPrincipal() actor: AuthenticatedPrincipal,
  ): Promise<CampaignSummaryDto> {
    return this.campaigns.create(input, actor.userId);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSION_CODES.SETTINGS_WRITE)
  @ApiOkResponse({ type: CampaignSummaryDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateCampaignDto,
    @CurrentPrincipal() actor: AuthenticatedPrincipal,
  ): Promise<CampaignSummaryDto> {
    return this.campaigns.update(id, input, actor.userId);
  }

  @Post(':id/transitions')
  @HttpCode(200)
  @RequirePermissions(PERMISSION_CODES.SETTINGS_WRITE)
  @ApiOkResponse({ type: CampaignSummaryDto })
  transition(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: CampaignTransitionDto,
    @CurrentPrincipal() actor: AuthenticatedPrincipal,
  ): Promise<CampaignSummaryDto> {
    return this.campaigns.transition(id, input, actor.userId);
  }
}
