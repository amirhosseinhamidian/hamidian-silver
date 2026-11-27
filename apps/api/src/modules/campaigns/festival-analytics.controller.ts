import { Controller, Get, Header, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { PERMISSION_CODES } from '../authorization/rbac.constants';
import { FestivalAnalyticsDto, FestivalAnalyticsQueryDto } from './dto/festival-analytics.dto';
import { FestivalAnalyticsService } from './festival-analytics.service';

@Controller({ path: 'campaigns', version: '1' })
export class FestivalAnalyticsController {
  constructor(private readonly analytics: FestivalAnalyticsService) {}

  @Get(':id/analytics')
  @Header('Cache-Control', 'private, no-store')
  @RequirePermissions(PERMISSION_CODES.FINANCE_READ)
  @ApiOkResponse({ type: FestivalAnalyticsDto })
  read(@Param('id', ParseUUIDPipe) id: string, @Query() query: FestivalAnalyticsQueryDto) {
    return this.analytics.read(id, query);
  }
}
