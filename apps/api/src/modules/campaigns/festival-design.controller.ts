import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';
import { CurrentPrincipal } from '../auth/current-principal.decorator';
import type { AuthenticatedPrincipal } from '../authorization/authorization.types';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { PERMISSION_CODES } from '../authorization/rbac.constants';
import {
  FestivalDesignDto,
  FestivalDesignEditorDto,
  FestivalPreviewDto,
  RestoreFestivalDesignDto,
  SaveFestivalDesignDto,
} from './dto/festival-design.dto';
import { FestivalDesignService } from './festival-design.service';

@Controller({ path: 'campaigns/:id/design', version: '1' })
export class FestivalDesignController {
  constructor(private readonly design: FestivalDesignService) {}

  @Get()
  @RequirePermissions(PERMISSION_CODES.SETTINGS_READ)
  @ApiOkResponse({ type: FestivalDesignEditorDto })
  edit(@Param('id', ParseUUIDPipe) id: string) {
    return this.design.editor(id);
  }

  @Put()
  @RequirePermissions(PERMISSION_CODES.SETTINGS_WRITE)
  @ApiOkResponse({ type: FestivalDesignEditorDto })
  save(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: SaveFestivalDesignDto,
    @CurrentPrincipal() actor: AuthenticatedPrincipal,
  ) {
    return this.design.save(id, input, actor.userId);
  }

  @Post('restore')
  @HttpCode(200)
  @RequirePermissions(PERMISSION_CODES.SETTINGS_WRITE)
  @ApiOkResponse({ type: FestivalDesignEditorDto })
  restore(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: RestoreFestivalDesignDto,
    @CurrentPrincipal() actor: AuthenticatedPrincipal,
  ) {
    return this.design.restore(id, input.expectedRevision, input.revision, actor.userId);
  }

  @Post('preview')
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store')
  @RequirePermissions(PERMISSION_CODES.SETTINGS_READ)
  @ApiOkResponse({ type: FestivalPreviewDto })
  preview(@Param('id', ParseUUIDPipe) id: string, @Body() input: FestivalDesignDto) {
    return this.design.preview(id, input);
  }
}
