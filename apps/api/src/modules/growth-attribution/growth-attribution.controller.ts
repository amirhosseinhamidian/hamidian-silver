import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
} from '@nestjs/swagger';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { Public } from '../auth/public.decorator';
import { PERMISSION_CODES } from '../authorization/rbac.constants';
import { CampaignLinksService } from './campaign-links.service';
import { CampaignLinkDto, CreateCampaignLinkDto } from './dto/attribution.dto';
import {
  GrowthCostDto,
  GrowthCostsDto,
  GrowthDashboardDto,
  GrowthDashboardQueryDto,
  GrowthMeasurementDto,
  RecordGrowthCostDto,
} from './dto/growth-dashboard.dto';
import {
  GrowthRevenueEventsDto,
  GrowthRevenueEventsQueryDto,
  GrowthRevenueQueryDto,
  GrowthRevenueSummaryDto,
} from './dto/growth-revenue.dto';
import { GrowthRevenueService } from './growth-revenue.service';
import { GrowthDashboardService } from './growth-dashboard.service';
import { GrowthMeasurementService } from './growth-measurement.service';

@Controller('growth-attribution')
export class GrowthAttributionController {
  constructor(
    private readonly links: CampaignLinksService,
    private readonly revenue: GrowthRevenueService,
    private readonly dashboard: GrowthDashboardService,
    private readonly measurement: GrowthMeasurementService,
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

  @Get('dashboard')
  @RequirePermissions(PERMISSION_CODES.FINANCE_READ)
  @ApiOkResponse({ type: GrowthDashboardDto })
  readDashboard(@Query() query: GrowthDashboardQueryDto) {
    return this.dashboard.read(query);
  }

  @Get('dashboard/costs')
  @RequirePermissions(PERMISSION_CODES.FINANCE_READ)
  @ApiOkResponse({ type: GrowthCostsDto })
  readCosts(@Query() query: GrowthDashboardQueryDto) {
    return this.dashboard.costs(query);
  }

  @Post('dashboard/costs')
  @RequirePermissions(PERMISSION_CODES.FINANCE_READ, PERMISSION_CODES.FINANCE_WRITE)
  @ApiCreatedResponse({ type: GrowthCostDto })
  recordCost(@Body() input: RecordGrowthCostDto) {
    return this.dashboard.recordCost(input);
  }

  @Post('measurement')
  @Public()
  @HttpCode(204)
  @ApiNoContentResponse()
  async measure(@Body() event: GrowthMeasurementDto) {
    await this.measurement.record(event);
  }
}
