import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
} from '@nestjs/swagger';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { PERMISSION_CODES } from '../authorization/rbac.constants';
import { CampaignLinksService } from './campaign-links.service';
import { CampaignLinkDto, CreateCampaignLinkDto } from './dto/attribution.dto';
import {
  GrowthRevenueEventsDto,
  GrowthRevenueEventsQueryDto,
  GrowthRevenueQueryDto,
  GrowthRevenueSummaryDto,
} from './dto/growth-revenue.dto';
import { GrowthRevenueService } from './growth-revenue.service';

@Controller('growth-attribution')
export class GrowthAttributionController {
  constructor(
    private readonly links: CampaignLinksService,
    private readonly revenue: GrowthRevenueService,
  ) {}

  @Post('campaign-links')
  @RequirePermissions(PERMISSION_CODES.SETTINGS_WRITE)
  @ApiCreatedResponse({ type: CampaignLinkDto })
  @ApiConflictResponse({ description: 'Tracking parameters or a campaign identity conflict.' })
  @ApiBadRequestResponse({ description: 'Invalid destination or campaign labels.' })
  createCampaignLink(@Body() input: CreateCampaignLinkDto) {
    return this.links.create(input);
  }

  @Get('revenue')
  @RequirePermissions(PERMISSION_CODES.FINANCE_READ)
  @ApiOkResponse({ type: GrowthRevenueSummaryDto })
  @ApiBadRequestResponse({ description: 'Invalid reporting period or filters.' })
  summary(@Query() query: GrowthRevenueQueryDto) {
    return this.revenue.summary(query);
  }

  @Get('revenue/events')
  @RequirePermissions(PERMISSION_CODES.FINANCE_READ)
  @ApiOkResponse({ type: GrowthRevenueEventsDto })
  @ApiBadRequestResponse({ description: 'Invalid reporting period, filters or pagination.' })
  events(@Query() query: GrowthRevenueEventsQueryDto) {
    return this.revenue.events(query);
  }
}
