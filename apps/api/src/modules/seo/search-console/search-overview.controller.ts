import { Controller, Get, Header, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../authorization/permissions.decorator';
import { PERMISSION_CODES } from '../../authorization/rbac.constants';
import {
  SearchOverviewDto,
  SearchOverviewQueryDto,
  SearchOverviewRowsDto,
  SearchOverviewRowsQueryDto,
} from '../dto/search-overview.dto';
import { SearchOverviewService } from './search-overview.service';

@ApiTags('SEO')
@Controller('seo/search-overview')
@RequirePermissions(PERMISSION_CODES.SETTINGS_READ)
export class SearchOverviewController {
  constructor(private readonly report: SearchOverviewService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  @ApiOkResponse({ type: SearchOverviewDto })
  overview(@Query() query: SearchOverviewQueryDto) {
    return this.report.overview(query);
  }

  @Get('rows')
  @Header('Cache-Control', 'private, no-store')
  @ApiOkResponse({ type: SearchOverviewRowsDto })
  rows(@Query() query: SearchOverviewRowsQueryDto) {
    return this.report.rows(query);
  }
}
