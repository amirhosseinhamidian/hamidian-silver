import { Body, Controller, Post } from '@nestjs/common';
import { ApiCreatedResponse } from '@nestjs/swagger';
import { CurrentPrincipal } from '../auth/current-principal.decorator';
import type { AuthenticatedPrincipal } from '../authorization/authorization.types';
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
}
