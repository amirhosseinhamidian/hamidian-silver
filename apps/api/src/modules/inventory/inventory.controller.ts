import { Body, Controller, Get, Patch, Post, Query } from '@nestjs/common';
import { CurrentPrincipal } from '../auth/current-principal.decorator';
import type { AuthenticatedPrincipal } from '../authorization/authorization.types';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { PERMISSION_CODES } from '../authorization/rbac.constants';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { BulkSetStockDto } from './dto/bulk-set-stock.dto';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { ListInventoryQueryDto } from './dto/list-inventory-query.dto';
import { SetLowStockThresholdDto } from './dto/set-low-stock-threshold.dto';
import { InventoryService } from './inventory.service';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post('warehouses')
  @RequirePermissions(PERMISSION_CODES.INVENTORY_WRITE)
  createWarehouse(@Body() dto: CreateWarehouseDto) {
    return this.inventoryService.createWarehouse(dto);
  }

  @Get('warehouses')
  @RequirePermissions(PERMISSION_CODES.INVENTORY_READ)
  listWarehouses() {
    return this.inventoryService.listWarehouses();
  }

  @Post('stock/adjust')
  @RequirePermissions(PERMISSION_CODES.INVENTORY_WRITE)
  adjustStock(@Body() dto: AdjustStockDto, @CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.inventoryService.adjustStock(dto, principal.userId);
  }

  @Post('stock/bulk-set')
  @RequirePermissions(PERMISSION_CODES.INVENTORY_WRITE)
  bulkSetStock(
    @Body() dto: BulkSetStockDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ) {
    return this.inventoryService.bulkSetStock(dto, principal.userId);
  }

  @Patch('stock/low-stock-threshold')
  @RequirePermissions(PERMISSION_CODES.INVENTORY_WRITE)
  setLowStockThreshold(@Body() dto: SetLowStockThresholdDto) {
    return this.inventoryService.setLowStockThreshold(dto);
  }

  @Get('stock')
  @RequirePermissions(PERMISSION_CODES.INVENTORY_READ)
  listStock(@Query() query: ListInventoryQueryDto) {
    return this.inventoryService.listStock(query);
  }
}
