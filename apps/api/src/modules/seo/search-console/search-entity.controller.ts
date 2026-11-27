import {
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { ApiOkResponse, ApiParam, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../authorization/permissions.decorator';
import { PERMISSION_CODES } from '../../authorization/rbac.constants';
import {
  SearchEntityDetailDto,
  SearchEntityDetailQueryDto,
  SearchEntityListDto,
  SearchEntityListQueryDto,
  seoEntityKinds,
} from '../dto/search-entity.dto';
import { SearchEntityService } from './search-entity.service';

@ApiTags('SEO')
@Controller('seo/search-entities')
@RequirePermissions(PERMISSION_CODES.SETTINGS_READ)
export class SearchEntityController {
  constructor(private readonly reports: SearchEntityService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  @ApiOkResponse({ type: SearchEntityListDto })
  list(@Query() query: SearchEntityListQueryDto) {
    return this.reports.list(query);
  }

  @Get(':kind/:id')
  @Header('Cache-Control', 'private, no-store')
  @ApiParam({ name: 'kind', enum: [...seoEntityKinds] })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: SearchEntityDetailDto })
  detail(
    @Param('kind') value: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: SearchEntityDetailQueryDto,
  ) {
    const kind = seoEntityKinds.find((entry) => entry === value);
    if (!kind) throw new NotFoundException('Unknown SEO entity type.');
    return this.reports.detail(kind, id, query);
  }
}
