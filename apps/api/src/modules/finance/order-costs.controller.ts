import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { CurrentPrincipal } from '../auth/current-principal.decorator';
import type { AuthenticatedPrincipal } from '../authorization/authorization.types';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { PERMISSION_CODES } from '../authorization/rbac.constants';
import { CreateOrderCostDto } from './dto/create-order-cost.dto';
import { ListOrderCostsQueryDto } from './dto/list-order-costs-query.dto';
import { ReverseOrderCostDto } from './dto/reverse-order-cost.dto';
import { OrderCostsService } from './order-costs.service';

@Controller('finance')
export class OrderCostsController {
  constructor(private readonly orderCostsService: OrderCostsService) {}

  @Get('order-costs')
  @RequirePermissions(PERMISSION_CODES.FINANCE_READ)
  list(@Query() query: ListOrderCostsQueryDto) {
    return this.orderCostsService.list(query);
  }

  @Get('order-costs/:costId')
  @RequirePermissions(PERMISSION_CODES.FINANCE_READ)
  get(
    @Param('costId', new ParseUUIDPipe({ version: '4' }))
    costId: string,
  ) {
    return this.orderCostsService.get(costId);
  }

  @Post('order-costs')
  @RequirePermissions(PERMISSION_CODES.FINANCE_WRITE)
  create(@Body() dto: CreateOrderCostDto, @CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.orderCostsService.create(principal.userId, dto);
  }

  @Post('order-costs/:costId/reverse')
  @RequirePermissions(PERMISSION_CODES.FINANCE_WRITE)
  reverse(
    @Param('costId', new ParseUUIDPipe({ version: '4' }))
    costId: string,
    @Body() dto: ReverseOrderCostDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ) {
    return this.orderCostsService.reverse(costId, principal.userId, dto);
  }

  @Get('orders/:orderId/contribution')
  @RequirePermissions(PERMISSION_CODES.FINANCE_READ)
  contribution(
    @Param('orderId', new ParseUUIDPipe({ version: '4' }))
    orderId: string,
  ) {
    return this.orderCostsService.contribution(orderId);
  }
}
