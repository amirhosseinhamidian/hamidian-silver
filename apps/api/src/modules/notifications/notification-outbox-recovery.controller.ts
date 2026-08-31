import { Body, Controller, Get, Param, ParseUUIDPipe, Patch } from '@nestjs/common';
import { CurrentPrincipal } from '../auth/current-principal.decorator';
import type { AuthenticatedPrincipal } from '../authorization/authorization.types';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { PERMISSION_CODES } from '../authorization/rbac.constants';
import { ResolveNotificationOutboxRecoveryDto } from './dto/resolve-notification-outbox-recovery.dto';
import { NotificationOutboxRecoveryService } from './notification-outbox-recovery.service';

@Controller('notifications/recovery')
export class NotificationOutboxRecoveryController {
  constructor(private readonly recoveryService: NotificationOutboxRecoveryService) {}

  @Get('unknown')
  @RequirePermissions(PERMISSION_CODES.ORDERS_READ)
  listUnknown() {
    return this.recoveryService.listUnknown();
  }

  @Patch('customer/:eventId/resolve')
  @RequirePermissions(PERMISSION_CODES.ORDERS_STATUS_WRITE)
  resolveCustomer(
    @Param('eventId', new ParseUUIDPipe({ version: '4' })) eventId: string,
    @Body() dto: ResolveNotificationOutboxRecoveryDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ) {
    return this.recoveryService.resolveCustomer(eventId, principal.userId, dto);
  }

  @Patch('operational/:eventId/resolve')
  @RequirePermissions(PERMISSION_CODES.ORDERS_STATUS_WRITE)
  resolveOperational(
    @Param('eventId', new ParseUUIDPipe({ version: '4' })) eventId: string,
    @Body() dto: ResolveNotificationOutboxRecoveryDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ) {
    return this.recoveryService.resolveOperational(eventId, principal.userId, dto);
  }
}
