import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Put } from '@nestjs/common';
import { CurrentPrincipal } from '../auth/current-principal.decorator';
import type { AuthenticatedPrincipal } from '../authorization/authorization.types';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { PERMISSION_CODES } from '../authorization/rbac.constants';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { SetProductSupplierDto } from './dto/set-product-supplier.dto';
import { SetSalePriceDto } from './dto/set-sale-price.dto';
import { PricingService } from './pricing.service';

@Controller('pricing')
export class PricingController {
  constructor(private readonly pricingService: PricingService) {}

  @Post('suppliers')
  @RequirePermissions(PERMISSION_CODES.PRICING_WRITE)
  createSupplier(@Body() dto: CreateSupplierDto) {
    return this.pricingService.createSupplier(dto);
  }

  @Get('suppliers')
  @RequirePermissions(PERMISSION_CODES.PRICING_READ)
  listSuppliers() {
    return this.pricingService.listSuppliers();
  }

  @Put('products/:productId/suppliers/:supplierId')
  @RequirePermissions(PERMISSION_CODES.PRICING_WRITE)
  setProductSupplier(
    @Param('productId', new ParseUUIDPipe({ version: '4' })) productId: string,
    @Param('supplierId', new ParseUUIDPipe({ version: '4' })) supplierId: string,
    @Body() dto: SetProductSupplierDto,
  ) {
    return this.pricingService.setProductSupplier(productId, supplierId, dto);
  }

  @Get('products/:productId')
  @RequirePermissions(PERMISSION_CODES.PRICING_READ)
  getProductPricing(@Param('productId', new ParseUUIDPipe({ version: '4' })) productId: string) {
    return this.pricingService.getProductPricing(productId);
  }

  @Patch('products/:productId/sale-price')
  @RequirePermissions(PERMISSION_CODES.PRICING_WRITE)
  setSalePrice(
    @Param('productId', new ParseUUIDPipe({ version: '4' })) productId: string,
    @Body() dto: SetSalePriceDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ) {
    return this.pricingService.setSalePrice(productId, dto, principal.userId);
  }

  @Get('products/:productId/history')
  @RequirePermissions(PERMISSION_CODES.PRICING_READ)
  listPriceHistory(@Param('productId', new ParseUUIDPipe({ version: '4' })) productId: string) {
    return this.pricingService.listPriceHistory(productId);
  }
}
