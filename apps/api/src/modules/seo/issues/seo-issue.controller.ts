import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentPrincipal } from '../../auth/current-principal.decorator';
import type { AuthenticatedPrincipal } from '../../authorization/authorization.types';
import { RequirePermissions } from '../../authorization/permissions.decorator';
import { PERMISSION_CODES } from '../../authorization/rbac.constants';
import {
  SeoIssueDetailDto,
  SeoIssueListDto,
  SeoIssueListQueryDto,
  SeoIssuePageQueryDto,
  SeoIssueScanDto,
  SeoIssueUpdateDto,
} from './seo-issue.dto';
import { SeoIssueService } from './seo-issue.service';

@ApiTags('SEO')
@Controller('seo/issues')
export class SeoIssueController {
  constructor(private readonly issues: SeoIssueService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  @RequirePermissions(PERMISSION_CODES.SETTINGS_READ)
  @ApiOkResponse({ type: SeoIssueListDto })
  list(@Query() query: SeoIssueListQueryDto): Promise<SeoIssueListDto> {
    return this.issues.list(query.page, query.status);
  }

  @Post('scan')
  @RequirePermissions(PERMISSION_CODES.SETTINGS_WRITE)
  @ApiCreatedResponse({ type: SeoIssueScanDto })
  scan(): Promise<SeoIssueScanDto> {
    return this.issues.scan();
  }

  @Get(':id')
  @Header('Cache-Control', 'private, no-store')
  @RequirePermissions(PERMISSION_CODES.SETTINGS_READ)
  @ApiOkResponse({ type: SeoIssueDetailDto })
  detail(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Query() query: SeoIssuePageQueryDto,
  ): Promise<SeoIssueDetailDto> {
    return this.issues.detail(id, query.page);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSION_CODES.SETTINGS_WRITE)
  @ApiOkResponse({ type: SeoIssueDetailDto })
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() body: SeoIssueUpdateDto,
  ): Promise<SeoIssueDetailDto> {
    return this.issues.update(id, principal.userId, body);
  }
}
