import { Controller, Get, Header, Post, Query } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../authorization/permissions.decorator';
import { PERMISSION_CODES } from '../../authorization/rbac.constants';
import { SeoAuditOverviewDto, SeoAuditQueryDto, SeoAuditQueuedDto } from './seo-audit.dto';
import { SeoAuditService } from './seo-audit.service';

@ApiTags('SEO')
@Controller('seo/technical-audits')
export class SeoAuditController {
  constructor(private readonly audits: SeoAuditService) {}

  @Get()
  @RequirePermissions(PERMISSION_CODES.SETTINGS_READ)
  @Header('Cache-Control', 'private, no-store')
  @ApiOkResponse({ type: SeoAuditOverviewDto })
  overview(@Query() query: SeoAuditQueryDto): Promise<SeoAuditOverviewDto> {
    return this.audits.overview(query.runId);
  }

  @Post()
  @RequirePermissions(PERMISSION_CODES.SETTINGS_WRITE)
  @ApiCreatedResponse({ type: SeoAuditQueuedDto })
  start(): Promise<SeoAuditQueuedDto> {
    return this.audits.start();
  }
}
