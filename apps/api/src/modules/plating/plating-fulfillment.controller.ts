import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { CurrentPrincipal } from '../auth/current-principal.decorator';
import type { AuthenticatedPrincipal } from '../authorization/authorization.types';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { PERMISSION_CODES } from '../authorization/rbac.constants';
import { CancelPlatingFulfillmentDto } from './dto/cancel-plating-fulfillment.dto';
import { CompletePlatingFulfillmentDto } from './dto/complete-plating-fulfillment.dto';
import { ListPlatingFulfillmentsQueryDto } from './dto/list-plating-fulfillments-query.dto';
import { StartPlatingFulfillmentDto } from './dto/start-plating-fulfillment.dto';
import { PlatingFulfillmentService } from './plating-fulfillment.service';

@Controller('operations/plating/orders')
export class PlatingFulfillmentController {
  constructor(private readonly platingFulfillmentService: PlatingFulfillmentService) {}

  @Get()
  @RequirePermissions(PERMISSION_CODES.ORDERS_READ)
  list(@Query() query: ListPlatingFulfillmentsQueryDto) {
    return this.platingFulfillmentService.list(query);
  }

  @Get(':orderId')
  @RequirePermissions(PERMISSION_CODES.ORDERS_READ)
  get(
    @Param('orderId', new ParseUUIDPipe({ version: '4' }))
    orderId: string,
  ) {
    return this.platingFulfillmentService.get(orderId);
  }

  @Post(':orderId/start')
  @RequirePermissions(PERMISSION_CODES.ORDERS_STATUS_WRITE)
  start(
    @Param('orderId', new ParseUUIDPipe({ version: '4' }))
    orderId: string,
    @Body() dto: StartPlatingFulfillmentDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ) {
    return this.platingFulfillmentService.start(orderId, principal.userId, dto);
  }

  @Post(':orderId/complete')
  @RequirePermissions(PERMISSION_CODES.ORDERS_STATUS_WRITE, PERMISSION_CODES.FINANCE_WRITE)
  complete(
    @Param('orderId', new ParseUUIDPipe({ version: '4' }))
    orderId: string,
    @Body() dto: CompletePlatingFulfillmentDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ) {
    return this.platingFulfillmentService.complete(orderId, principal.userId, dto);
  }

  @Post(':orderId/cancel')
  @RequirePermissions(PERMISSION_CODES.ORDERS_STATUS_WRITE)
  cancel(
    @Param('orderId', new ParseUUIDPipe({ version: '4' }))
    orderId: string,
    @Body() dto: CancelPlatingFulfillmentDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ) {
    return this.platingFulfillmentService.cancel(orderId, principal.userId, dto);
  }
}
