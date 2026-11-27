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
  SeoOpportunityDetailDto,
  SeoOpportunityListDto,
  SeoOpportunityPageDto,
  SeoOpportunityQueryDto,
  SeoOpportunityRefreshDto,
  SeoOpportunityUpdateDto,
} from './seo-opportunity.dto';
import { SeoOpportunityService } from './seo-opportunity.service';

@ApiTags('SEO')
@Controller('seo/opportunities')
export class SeoOpportunityController {
  constructor(private readonly service: SeoOpportunityService) {}

  @Get()
  @RequirePermissions(PERMISSION_CODES.SETTINGS_READ)
  @Header('Cache-Control', 'private, no-store')
  @ApiOkResponse({ type: SeoOpportunityListDto })
  list(@Query() query: SeoOpportunityQueryDto): Promise<SeoOpportunityListDto> {
    return this.service.list(query.page, query.status);
  }

  @Post('refresh')
  @RequirePermissions(PERMISSION_CODES.SETTINGS_WRITE)
  @ApiCreatedResponse({ type: SeoOpportunityRefreshDto })
  refresh(): Promise<SeoOpportunityRefreshDto> {
    return this.service.refresh();
  }

  @Get(':id')
  @RequirePermissions(PERMISSION_CODES.SETTINGS_READ)
  @Header('Cache-Control', 'private, no-store')
  @ApiOkResponse({ type: SeoOpportunityDetailDto })
  detail(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Query() query: SeoOpportunityPageDto,
  ): Promise<SeoOpportunityDetailDto> {
    return this.service.detail(id, query.page);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSION_CODES.SETTINGS_WRITE)
  @ApiOkResponse({ type: SeoOpportunityDetailDto })
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() input: SeoOpportunityUpdateDto,
  ): Promise<SeoOpportunityDetailDto> {
    return this.service.update(id, principal.userId, input);
  }
}
