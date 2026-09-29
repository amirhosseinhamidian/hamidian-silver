import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Put } from '@nestjs/common';
import { CurrentPrincipal } from '../auth/current-principal.decorator';
import type { AuthenticatedPrincipal } from '../authorization/authorization.types';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { PERMISSION_CODES } from '../authorization/rbac.constants';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { CreateSupplierSourceDto } from './dto/create-supplier-source.dto';
import { SetProductSupplierDto } from './dto/set-product-supplier.dto';
import { SetSalePriceDto } from './dto/set-sale-price.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { UpdateSupplierSourceDto } from './dto/update-supplier-source.dto';
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

  @Get('suppliers/catalog')
  @RequirePermissions(PERMISSION_CODES.PRICING_READ)
  getSupplierCatalog() {
    return this.pricingService.getSupplierCatalog();
  }

  @Get('catalog')
  @RequirePermissions(PERMISSION_CODES.PRICING_READ)
  getPricingCatalog() {
    return this.pricingService.getPricingCatalog();
  }

  @Patch('suppliers/:supplierId')
  @RequirePermissions(PERMISSION_CODES.PRICING_WRITE)
  updateSupplier(
    @Param('supplierId', new ParseUUIDPipe({ version: '4' })) supplierId: string,
    @Body() dto: UpdateSupplierDto,
  ) {
    return this.pricingService.updateSupplier(supplierId, dto);
  }

  @Get('suppliers/:supplierId/sources')
  @RequirePermissions(PERMISSION_CODES.PRICING_READ)
  listSupplierSources(
    @Param('supplierId', new ParseUUIDPipe({ version: '4' })) supplierId: string,
  ) {
    return this.pricingService.listSupplierSources(supplierId);
  }

  @Post('suppliers/:supplierId/sources')
  @RequirePermissions(PERMISSION_CODES.PRICING_WRITE)
  createSupplierSource(
    @Param('supplierId', new ParseUUIDPipe({ version: '4' })) supplierId: string,
    @Body() dto: CreateSupplierSourceDto,
  ) {
    return this.pricingService.createSupplierSource(supplierId, dto);
  }

  @Patch('suppliers/:supplierId/sources/:sourceId')
  @RequirePermissions(PERMISSION_CODES.PRICING_WRITE)
  updateSupplierSource(
    @Param('supplierId', new ParseUUIDPipe({ version: '4' })) supplierId: string,
    @Param('sourceId', new ParseUUIDPipe({ version: '4' })) sourceId: string,
    @Body() dto: UpdateSupplierSourceDto,
  ) {
    return this.pricingService.updateSupplierSource(supplierId, sourceId, dto);
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
