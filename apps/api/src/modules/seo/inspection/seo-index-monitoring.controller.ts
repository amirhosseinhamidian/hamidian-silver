import {
  Body,
  Controller,
  Get,
  Header,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../authorization/permissions.decorator';
import { PERMISSION_CODES } from '../../authorization/rbac.constants';
import { COVERAGE_UPLOAD_LIMIT } from './seo-coverage-import';
import {
  SeoCoverageOverviewDto,
  SeoCoverageQueryDto,
  SeoCoverageStoredDto,
  SeoCoverageUploadDto,
  SeoIndexOverviewDto,
  SeoIndexQueryDto,
  SeoInspectionQueuedDto,
} from './seo-index-monitoring.dto';
import { SeoIndexMonitoringService } from './seo-index-monitoring.service';

@ApiTags('SEO')
@Controller('seo/index-monitoring')
export class SeoIndexMonitoringController {
  constructor(private readonly monitoring: SeoIndexMonitoringService) {}

  @Get()
  @RequirePermissions(PERMISSION_CODES.SETTINGS_READ)
  @Header('Cache-Control', 'private, no-store')
  @ApiOkResponse({ type: SeoIndexOverviewDto })
  overview(@Query() query: SeoIndexQueryDto): Promise<SeoIndexOverviewDto> {
    return this.monitoring.overview(query.page, query.q);
  }

  @Post('queue')
  @RequirePermissions(PERMISSION_CODES.SETTINGS_WRITE)
  @ApiCreatedResponse({ type: SeoInspectionQueuedDto })
  queue(): Promise<SeoInspectionQueuedDto> {
    return this.monitoring.queue();
  }

  @Get('coverage')
  @RequirePermissions(PERMISSION_CODES.SETTINGS_READ)
  @Header('Cache-Control', 'private, no-store')
  @ApiOkResponse({ type: SeoCoverageOverviewDto })
  coverage(@Query() query: SeoCoverageQueryDto): Promise<SeoCoverageOverviewDto> {
    return this.monitoring.coverage(query.id, query.page, query.reason);
  }

  @Post('coverage')
  @RequirePermissions(PERMISSION_CODES.SETTINGS_WRITE)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: COVERAGE_UPLOAD_LIMIT, files: 1, fields: 2, fieldSize: 1024 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'label', 'reportDate'],
      properties: {
        file: { type: 'string', format: 'binary' },
        label: { type: 'string', minLength: 1, maxLength: 120 },
        reportDate: { type: 'string', format: 'date' },
      },
    },
  })
  @ApiCreatedResponse({ type: SeoCoverageStoredDto })
  importCoverage(
    @UploadedFile() file: { buffer: Buffer } | undefined,
    @Body() body: SeoCoverageUploadDto,
  ): Promise<SeoCoverageStoredDto> {
    return this.monitoring.importCoverage(file?.buffer, body.label, body.reportDate);
  }
}
