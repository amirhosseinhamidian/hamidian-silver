import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiCreatedResponse } from '@nestjs/swagger';
import { CurrentPrincipal } from '../auth/current-principal.decorator';
import type { AuthenticatedPrincipal } from '../authorization/authorization.types';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { PERMISSION_CODES } from '../authorization/rbac.constants';
import { CreateStockNotificationDto } from './dto/create-stock-notification.dto';
import { StockNotificationResponseDto } from './dto/stock-notification-response.dto';
import { StockNotificationsService } from './stock-notifications.service';

@Controller('stock-notifications')
export class StockNotificationsController {
  constructor(private readonly stockNotificationsService: StockNotificationsService) {}

  @Post()
  @ApiCreatedResponse({ type: StockNotificationResponseDto })
  subscribe(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: CreateStockNotificationDto,
  ) {
    return this.stockNotificationsService.subscribe(principal.userId, dto);
  }

  @Get('admin/summary')
  @RequirePermissions(PERMISSION_CODES.INVENTORY_READ)
  getAdminSummary() {
    return this.stockNotificationsService.getAdminSummary();
  }
}
