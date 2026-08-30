import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { CurrentPrincipal } from '../auth/current-principal.decorator';
import type { AuthenticatedPrincipal } from '../authorization/authorization.types';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { PERMISSION_CODES } from '../authorization/rbac.constants';
import { CancelOrderReturnDto } from './dto/cancel-order-return.dto';
import { CreateOrderReturnDto } from './dto/create-order-return.dto';
import { ReceiveOrderReturnDto } from './dto/receive-order-return.dto';
import { OrderReturnsService } from './order-returns.service';

@Controller('orders')
export class OrderReturnsController {
  constructor(private readonly orderReturnsService: OrderReturnsService) {}

  @Post(':orderId/returns')
  @RequirePermissions(PERMISSION_CODES.ORDERS_STATUS_WRITE)
  create(
    @Param('orderId', new ParseUUIDPipe({ version: '4' }))
    orderId: string,
    @Body() dto: CreateOrderReturnDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ) {
    return this.orderReturnsService.create(orderId, principal.userId, dto);
  }

  @Get(':orderId/returns')
  @RequirePermissions(PERMISSION_CODES.ORDERS_READ)
  listForOrder(
    @Param('orderId', new ParseUUIDPipe({ version: '4' }))
    orderId: string,
  ) {
    return this.orderReturnsService.listForOrder(orderId);
  }

  @Get('returns/:returnId')
  @RequirePermissions(PERMISSION_CODES.ORDERS_READ)
  get(
    @Param('returnId', new ParseUUIDPipe({ version: '4' }))
    returnId: string,
  ) {
    return this.orderReturnsService.get(returnId);
  }

  @Post('returns/:returnId/receive')
  @RequirePermissions(PERMISSION_CODES.ORDERS_STATUS_WRITE, PERMISSION_CODES.INVENTORY_WRITE)
  receive(
    @Param('returnId', new ParseUUIDPipe({ version: '4' }))
    returnId: string,
    @Body() dto: ReceiveOrderReturnDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ) {
    return this.orderReturnsService.receive(returnId, principal.userId, dto);
  }

  @Post('returns/:returnId/cancel')
  @RequirePermissions(PERMISSION_CODES.ORDERS_STATUS_WRITE)
  cancel(
    @Param('returnId', new ParseUUIDPipe({ version: '4' }))
    returnId: string,
    @Body() dto: CancelOrderReturnDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ) {
    return this.orderReturnsService.cancel(returnId, principal.userId, dto);
  }
}
