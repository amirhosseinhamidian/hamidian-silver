import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { CurrentPrincipal } from '../auth/current-principal.decorator';
import type { AuthenticatedPrincipal } from '../authorization/authorization.types';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { PERMISSION_CODES } from '../authorization/rbac.constants';
import { SelectShippingRateDto } from './dto/select-shipping-rate.dto';
import { UpdateShipmentStatusDto } from './dto/update-shipment-status.dto';
import { ShippingService } from './shipping.service';

@Controller('shipping')
export class ShippingController {
  constructor(private readonly shippingService: ShippingService) {}

  @Post('me/orders/:orderId/quote')
  quoteOrder(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('orderId', new ParseUUIDPipe({ version: '4' })) orderId: string,
  ) {
    return this.shippingService.quoteOrder(principal.userId, orderId);
  }

  @Post('me/orders/:orderId/select')
  selectRate(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('orderId', new ParseUUIDPipe({ version: '4' })) orderId: string,
    @Body() dto: SelectShippingRateDto,
  ) {
    return this.shippingService.selectRate(principal.userId, orderId, dto);
  }

  @Get('me/orders/:orderId')
  getMyShipment(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('orderId', new ParseUUIDPipe({ version: '4' })) orderId: string,
  ) {
    return this.shippingService.getMyShipment(principal.userId, orderId);
  }

  @Get('orders/:orderId')
  @RequirePermissions(PERMISSION_CODES.ORDERS_READ)
  getShipment(@Param('orderId', new ParseUUIDPipe({ version: '4' })) orderId: string) {
    return this.shippingService.getShipment(orderId);
  }

  @Patch('orders/:orderId/status')
  @RequirePermissions(PERMISSION_CODES.ORDERS_STATUS_WRITE)
  updateStatus(
    @Param('orderId', new ParseUUIDPipe({ version: '4' })) orderId: string,
    @Body() dto: UpdateShipmentStatusDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ) {
    return this.shippingService.updateStatus(orderId, dto, principal.userId);
  }
}
