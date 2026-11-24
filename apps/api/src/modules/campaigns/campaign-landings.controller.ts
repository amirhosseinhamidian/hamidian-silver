import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';
import { CurrentPrincipal } from '../auth/current-principal.decorator';
import { Public } from '../auth/public.decorator';
import type { AuthenticatedPrincipal } from '../authorization/authorization.types';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { PERMISSION_CODES } from '../authorization/rbac.constants';
import { CampaignLandingsService } from './campaign-landings.service';
import { CampaignPageQueryDto, PublicCampaignDto } from './dto/campaign.dto';
import {
  CampaignLandingDraftDto,
  CampaignLandingEditorDto,
  CampaignLandingPreviewDto,
  CampaignPlacementQueryDto,
  CampaignSitemapDto,
  PublicCampaignLandingDto,
  SaveCampaignLandingDto,
} from './dto/campaign-landing.dto';

@Controller({ path: 'campaigns', version: '1' })
export class CampaignLandingsController {
  constructor(private readonly landings: CampaignLandingsService) {}

  @Public()
  @Get('public/landing/:slug')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: PublicCampaignLandingDto })
  readLanding(@Param('slug') slug: string, @Query() query: CampaignPageQueryDto) {
    if (slug.length > 64 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || (query.page ?? 1) > 1000)
      throw new NotFoundException('Campaign landing not found.');
    return this.landings.publicLanding(slug, query.page ?? 1);
  }

  @Public()
  @Get('public/placement')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: PublicCampaignDto })
  async placement(@Query() query: CampaignPlacementQueryDto): Promise<PublicCampaignDto> {
    if ((query.slot === 'CATEGORY' || query.slot === 'PRODUCT') && !query.slug)
      throw new BadRequestException('A category or product slug is required.');
    if (query.slug?.includes('\0')) throw new BadRequestException('Invalid slug.');
    const result = await this.landings.placement(query.slot, query.slug);
    return { banner: result?.banner ?? null };
  }

  @Public()
  @Get('public/sitemap')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: CampaignSitemapDto })
  sitemap() {
    return this.landings.sitemap();
  }

  @Get(':id/landing')
  @RequirePermissions(PERMISSION_CODES.SETTINGS_READ)
  @ApiOkResponse({ type: CampaignLandingEditorDto })
  edit(@Param('id', ParseUUIDPipe) id: string) {
    return this.landings.editor(id);
  }

  @Put(':id/landing')
  @RequirePermissions(PERMISSION_CODES.SETTINGS_WRITE)
  @ApiOkResponse({ type: CampaignLandingEditorDto })
  save(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: SaveCampaignLandingDto,
    @CurrentPrincipal() actor: AuthenticatedPrincipal,
  ) {
    return this.landings.save(id, input, actor.userId);
  }

  @Post(':id/landing/preview')
  @HttpCode(200)
  @RequirePermissions(PERMISSION_CODES.SETTINGS_READ)
  @ApiOkResponse({ type: CampaignLandingPreviewDto })
  preview(@Param('id', ParseUUIDPipe) id: string, @Body() input: CampaignLandingDraftDto) {
    return this.landings.preview(id, input);
  }
}
