import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { CurrentPrincipal } from '../auth/current-principal.decorator';
import type { AuthenticatedPrincipal } from '../authorization/authorization.types';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { PERMISSION_CODES } from '../authorization/rbac.constants';
import { CancelSupplierSettlementDto } from './dto/cancel-supplier-settlement.dto';
import { CreateSupplierSettlementDto } from './dto/create-supplier-settlement.dto';
import { ListSupplierSettlementsQueryDto } from './dto/list-supplier-settlements-query.dto';
import { PaySupplierSettlementDto } from './dto/pay-supplier-settlement.dto';
import { SupplierSettlementsService } from './supplier-settlements.service';

@Controller('finance/supplier-settlements')
export class SupplierSettlementsController {
  constructor(private readonly supplierSettlementsService: SupplierSettlementsService) {}

  @Get()
  @RequirePermissions(PERMISSION_CODES.FINANCE_READ)
  list(@Query() query: ListSupplierSettlementsQueryDto) {
    return this.supplierSettlementsService.list(query);
  }

  @Get(':settlementId')
  @RequirePermissions(PERMISSION_CODES.FINANCE_READ)
  get(
    @Param('settlementId', new ParseUUIDPipe({ version: '4' }))
    settlementId: string,
  ) {
    return this.supplierSettlementsService.get(settlementId);
  }

  @Post()
  @RequirePermissions(PERMISSION_CODES.FINANCE_WRITE)
  create(
    @Body() dto: CreateSupplierSettlementDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ) {
    return this.supplierSettlementsService.create(principal.userId, dto);
  }

  @Post(':settlementId/pay')
  @RequirePermissions(PERMISSION_CODES.FINANCE_WRITE)
  pay(
    @Param('settlementId', new ParseUUIDPipe({ version: '4' }))
    settlementId: string,
    @Body() dto: PaySupplierSettlementDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ) {
    return this.supplierSettlementsService.pay(settlementId, principal.userId, dto);
  }

  @Post(':settlementId/cancel')
  @RequirePermissions(PERMISSION_CODES.FINANCE_WRITE)
  cancel(
    @Param('settlementId', new ParseUUIDPipe({ version: '4' }))
    settlementId: string,
    @Body() dto: CancelSupplierSettlementDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ) {
    return this.supplierSettlementsService.cancel(settlementId, principal.userId, dto);
  }
}
