import { Body, Controller, Get, Header, Param, ParseUUIDPipe, Put, Query } from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';
import { CurrentPrincipal } from '../auth/current-principal.decorator';
import { Public } from '../auth/public.decorator';
import type { AuthenticatedPrincipal } from '../authorization/authorization.types';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { PERMISSION_CODES } from '../authorization/rbac.constants';
import {
  AdminPromotionDto,
  CampaignProductPricePreviewDto,
  CampaignProductPriceQueryDto,
  PublicPromotionsDto,
  SavePromotionDto,
} from './dto/promotion.dto';
import { PromotionsService } from './promotions.service';

@Controller('promotions')
export class PromotionsController {
  constructor(private readonly promotions: PromotionsService) {}

  @Public()
  @Get('public')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: PublicPromotionsDto })
  listPublic(): Promise<PublicPromotionsDto> {
    return this.promotions.publicPromotions();
  }

  @Get(':campaignId')
  @RequirePermissions(PERMISSION_CODES.SETTINGS_READ)
  @ApiOkResponse({ type: AdminPromotionDto })
  read(@Param('campaignId', ParseUUIDPipe) campaignId: string): Promise<AdminPromotionDto> {
    return this.promotions.adminRule(campaignId);
  }

  @Get(':campaignId/product-preview')
  @RequirePermissions(PERMISSION_CODES.SETTINGS_READ)
  @ApiOkResponse({ type: CampaignProductPricePreviewDto })
  previewProduct(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Query() query: CampaignProductPriceQueryDto,
  ): Promise<CampaignProductPricePreviewDto> {
    return this.promotions.productPricePreview(campaignId, query.slug);
  }

  @Put(':campaignId')
  @RequirePermissions(PERMISSION_CODES.SETTINGS_WRITE)
  @ApiOkResponse({ type: AdminPromotionDto })
  save(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Body() input: SavePromotionDto,
    @CurrentPrincipal() actor: AuthenticatedPrincipal,
  ): Promise<AdminPromotionDto> {
    return this.promotions.save(campaignId, input, actor.userId);
  }
}
