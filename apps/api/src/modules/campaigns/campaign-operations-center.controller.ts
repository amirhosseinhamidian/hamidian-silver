import { Controller, Get, Header, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';
import { CurrentPrincipal } from '../auth/current-principal.decorator';
import type { AuthenticatedPrincipal } from '../authorization/authorization.types';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { PERMISSION_CODES } from '../authorization/rbac.constants';
import { CampaignOperationsCenterService } from './campaign-operations-center.service';
import {
  CampaignOperationsCenterDto,
  CampaignOperationsQueryDto,
} from './dto/campaign-operations-center.dto';

@Controller({ path: 'campaigns', version: '1' })
export class CampaignOperationsCenterController {
  constructor(private readonly center: CampaignOperationsCenterService) {}

  @Get(':id/operations')
  @Header('Cache-Control', 'private, no-store')
  @RequirePermissions(PERMISSION_CODES.SETTINGS_READ, PERMISSION_CODES.ORDERS_READ)
  @ApiOkResponse({ type: CampaignOperationsCenterDto })
  read(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: CampaignOperationsQueryDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ) {
    return this.center.read(
      id,
      query,
      principal.permissionCodes.includes(PERMISSION_CODES.FINANCE_READ),
    );
  }
}
