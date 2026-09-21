import { Body, Controller, Get, Param, ParseUUIDPipe, Put } from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';

import { CurrentPrincipal } from '../auth/current-principal.decorator';
import type { AuthenticatedPrincipal } from '../authorization/authorization.types';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { PERMISSION_CODES } from '../authorization/rbac.constants';
import { AdminMessageRecipientsService } from './admin-message-recipients.service';
import { AdminMessageRecipientSnapshotDto } from './dto/admin-message-recipient.dto';
import { UpdateAdminMessageRecipientDto } from './dto/update-admin-message-recipient.dto';

@Controller({ path: 'admin-order-notification-recipients', version: '1' })
export class AdminMessageRecipientsController {
  constructor(private readonly recipients: AdminMessageRecipientsService) {}

  @Get()
  @RequirePermissions(PERMISSION_CODES.SETTINGS_WRITE)
  @ApiOkResponse({ type: AdminMessageRecipientSnapshotDto })
  list(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.recipients.list(principal.roleCodes);
  }

  @Put(':userId')
  @RequirePermissions(PERMISSION_CODES.SETTINGS_WRITE)
  @ApiOkResponse({ type: AdminMessageRecipientSnapshotDto })
  update(
    @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string,
    @Body() dto: UpdateAdminMessageRecipientDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ) {
    return this.recipients.update(userId, principal.userId, principal.roleCodes, dto);
  }
}
