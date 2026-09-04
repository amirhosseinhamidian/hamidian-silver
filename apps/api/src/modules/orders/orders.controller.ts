import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse } from '@nestjs/swagger';
import { CurrentPrincipal } from '../auth/current-principal.decorator';
import type { AuthenticatedPrincipal } from '../authorization/authorization.types';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { PERMISSION_CODES } from '../authorization/rbac.constants';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { CustomerOrderDetailDto, CustomerOrderSummaryDto } from './dto/customer-order-response.dto';
import { ListOrdersQueryDto } from './dto/list-orders-query.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrdersService } from './orders.service';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @ApiCreatedResponse({ type: CustomerOrderDetailDto })
  createOrder(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: CreateOrderDto) {
    return this.ordersService.createOrder(principal.userId, dto);
  }

  @Get('me')
  @ApiOkResponse({ type: CustomerOrderSummaryDto, isArray: true })
  listMyOrders(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query() query: ListOrdersQueryDto,
  ) {
    return this.ordersService.listMyOrders(principal.userId, query);
  }

  @Get('me/:orderId')
  @ApiOkResponse({ type: CustomerOrderDetailDto })
  getMyOrder(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('orderId', new ParseUUIDPipe({ version: '4' })) orderId: string,
  ) {
    return this.ordersService.getMyOrder(principal.userId, orderId);
  }

  @Get()
  @RequirePermissions(PERMISSION_CODES.ORDERS_READ)
  listOrders(@Query() query: ListOrdersQueryDto) {
    return this.ordersService.listOrders(query);
  }

  @Patch(':orderId/status')
  @RequirePermissions(PERMISSION_CODES.ORDERS_STATUS_WRITE)
  updateStatus(
    @Param('orderId', new ParseUUIDPipe({ version: '4' })) orderId: string,
    @Body() dto: UpdateOrderStatusDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ) {
    return this.ordersService.updateStatus(orderId, dto, principal.userId);
  }

  @Post(':orderId/cancel')
  @RequirePermissions(PERMISSION_CODES.ORDERS_CANCEL)
  cancelOrder(
    @Param('orderId', new ParseUUIDPipe({ version: '4' })) orderId: string,
    @Body() dto: CancelOrderDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ) {
    return this.ordersService.cancelOrder(orderId, dto, principal.userId);
  }
}
