import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Put } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse } from '@nestjs/swagger';
import { CurrentPrincipal } from '../auth/current-principal.decorator';
import { Public } from '../auth/public.decorator';
import type { AuthenticatedPrincipal } from '../authorization/authorization.types';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { PERMISSION_CODES } from '../authorization/rbac.constants';
import { CreateManualShipmentDto } from './dto/create-manual-shipment.dto';
import { SelectShippingRateDto } from './dto/select-shipping-rate.dto';
import { ResetShipmentProviderCreationDto } from './dto/reset-shipment-provider-creation.dto';
import { UpdateShipmentStatusDto } from './dto/update-shipment-status.dto';
import {
  AdminShippingPricingSettingsDto,
  ShippingPricingSettingsDto,
} from './dto/shipping-pricing-settings.dto';
import { UpdateShippingPricingSettingsDto } from './dto/update-shipping-pricing-settings.dto';
import {
  CreateShippingCarrierDto,
  ShippingCarrierDto,
  UpdateShippingCarrierDto,
} from './dto/shipping-carrier.dto';
import { ShippingCarriersService } from './shipping-carriers.service';
import { ShippingPricingService } from './shipping-pricing.service';
import { ShippingService } from './shipping.service';

@Controller('shipping')
export class ShippingController {
  constructor(
    private readonly shippingService: ShippingService,
    private readonly shippingPricingService: ShippingPricingService,
    private readonly shippingCarriersService: ShippingCarriersService,
  ) {}

  @Public()
  @Get('pricing/public')
  @ApiOkResponse({ type: ShippingPricingSettingsDto })
  getPublicPricing(): Promise<ShippingPricingSettingsDto> {
    return this.shippingPricingService.getPublicSettings();
  }

  @Get('carriers')
  @RequirePermissions(PERMISSION_CODES.SETTINGS_READ)
  @ApiOkResponse({ type: ShippingCarrierDto, isArray: true })
  listCarriers() {
    return this.shippingCarriersService.listAll();
  }

  @Get('carriers/active')
  @RequirePermissions(PERMISSION_CODES.ORDERS_TRACKING_WRITE)
  @ApiOkResponse({ type: ShippingCarrierDto, isArray: true })
  listActiveCarriers() {
    return this.shippingCarriersService.listActive();
  }

  @Post('carriers')
  @RequirePermissions(PERMISSION_CODES.SETTINGS_WRITE)
  @ApiCreatedResponse({ type: ShippingCarrierDto })
  createCarrier(
    @Body() dto: CreateShippingCarrierDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ) {
    return this.shippingCarriersService.create(dto, principal.userId);
  }

  @Patch('carriers/:carrierId')
  @RequirePermissions(PERMISSION_CODES.SETTINGS_WRITE)
  @ApiOkResponse({ type: ShippingCarrierDto })
  updateCarrier(
    @Param('carrierId', new ParseUUIDPipe({ version: '4' })) carrierId: string,
    @Body() dto: UpdateShippingCarrierDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ) {
    return this.shippingCarriersService.update(carrierId, dto, principal.userId);
  }

  @Get('pricing')
  @RequirePermissions(PERMISSION_CODES.SETTINGS_READ)
  @ApiOkResponse({ type: AdminShippingPricingSettingsDto })
  getAdminPricing(): Promise<AdminShippingPricingSettingsDto> {
    return this.shippingPricingService.getAdminSettings();
  }

  @Put('pricing')
  @RequirePermissions(PERMISSION_CODES.SETTINGS_WRITE)
  @ApiOkResponse({ type: AdminShippingPricingSettingsDto })
  updatePricing(
    @Body() dto: UpdateShippingPricingSettingsDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<AdminShippingPricingSettingsDto> {
    return this.shippingPricingService.updateSettings(dto, principal.userId);
  }

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

  @Post('orders/:orderId/manual')
  @RequirePermissions(PERMISSION_CODES.ORDERS_TRACKING_WRITE)
  createManualShipment(
    @Param('orderId', new ParseUUIDPipe({ version: '4' })) orderId: string,
    @Body() dto: CreateManualShipmentDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ) {
    return this.shippingService.createManualShipment(orderId, dto, principal.userId);
  }

  @Post('orders/:orderId/create')
  @RequirePermissions(PERMISSION_CODES.ORDERS_TRACKING_WRITE)
  createProviderShipment(
    @Param('orderId', new ParseUUIDPipe({ version: '4' })) orderId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ) {
    return this.shippingService.createProviderShipment(orderId, principal.userId);
  }

  @Post('orders/:orderId/track')
  @RequirePermissions(PERMISSION_CODES.ORDERS_TRACKING_WRITE)
  syncTracking(@Param('orderId', new ParseUUIDPipe({ version: '4' })) orderId: string) {
    return this.shippingService.syncTracking(orderId);
  }

  @Post('orders/:orderId/provider-creation/reset')
  @RequirePermissions(PERMISSION_CODES.ORDERS_TRACKING_WRITE)
  resetProviderCreation(
    @Param('orderId', new ParseUUIDPipe({ version: '4' })) orderId: string,
    @Body() dto: ResetShipmentProviderCreationDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ) {
    return this.shippingService.resetProviderCreation(orderId, dto, principal.userId);
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
