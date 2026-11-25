import { Body, Controller, Get, Header, HttpCode, Post, Query } from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';
import { CurrentPrincipal } from '../auth/current-principal.decorator';
import type { AuthenticatedPrincipal } from '../authorization/authorization.types';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { PERMISSION_CODES } from '../authorization/rbac.constants';
import {
  ArchiveFestivalThemeDto,
  FestivalLibraryThemeDto,
  FestivalThemeHistoryQueryDto,
  FestivalThemeLibraryHistoryDto,
  FestivalThemeLibraryListDto,
  FestivalThemeLibraryQueryDto,
  SaveFestivalThemeDto,
} from './dto/festival-theme-library.dto';
import { FestivalThemeLibraryService } from './festival-theme-library.service';

@Controller({ path: 'festival-themes', version: '1' })
export class FestivalThemeLibraryController {
  constructor(private readonly library: FestivalThemeLibraryService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  @RequirePermissions(PERMISSION_CODES.SETTINGS_READ)
  @ApiOkResponse({ type: FestivalThemeLibraryListDto })
  list(@Query() query: FestivalThemeLibraryQueryDto) {
    return this.library.list(query);
  }

  @Get('history')
  @Header('Cache-Control', 'private, no-store')
  @RequirePermissions(PERMISSION_CODES.SETTINGS_READ)
  @ApiOkResponse({ type: FestivalThemeLibraryHistoryDto })
  history(@Query() query: FestivalThemeHistoryQueryDto) {
    return this.library.history(query);
  }

  @Post()
  @HttpCode(200)
  @RequirePermissions(PERMISSION_CODES.SETTINGS_WRITE)
  @ApiOkResponse({ type: FestivalLibraryThemeDto })
  save(@Body() input: SaveFestivalThemeDto, @CurrentPrincipal() actor: AuthenticatedPrincipal) {
    return this.library.save(input, actor.userId);
  }

  @Post('archive')
  @HttpCode(200)
  @RequirePermissions(PERMISSION_CODES.SETTINGS_WRITE)
  @ApiOkResponse({ type: FestivalLibraryThemeDto })
  archive(@Body() input: ArchiveFestivalThemeDto) {
    return this.library.archive(input);
  }
}
