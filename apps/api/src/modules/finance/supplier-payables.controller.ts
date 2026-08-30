import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { CurrentPrincipal } from '../auth/current-principal.decorator';
import type { AuthenticatedPrincipal } from '../authorization/authorization.types';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { PERMISSION_CODES } from '../authorization/rbac.constants';
import { ListSupplierPayablesQueryDto } from './dto/list-supplier-payables-query.dto';
import { MarkSupplierPayablePaidDto } from './dto/mark-supplier-payable-paid.dto';
import { SupplierPayablesService } from './supplier-payables.service';

@Controller('finance/supplier-payables')
export class SupplierPayablesController {
  constructor(private readonly supplierPayablesService: SupplierPayablesService) {}

  @Get()
  @RequirePermissions(PERMISSION_CODES.FINANCE_READ)
  list(@Query() query: ListSupplierPayablesQueryDto) {
    return this.supplierPayablesService.list(query);
  }

  @Get('summary')
  @RequirePermissions(PERMISSION_CODES.FINANCE_READ)
  summary() {
    return this.supplierPayablesService.summary();
  }

  @Patch(':payableId/mark-paid')
  @RequirePermissions(PERMISSION_CODES.FINANCE_WRITE)
  markPaid(
    @Param('payableId', new ParseUUIDPipe({ version: '4' }))
    payableId: string,
    @Body() dto: MarkSupplierPayablePaidDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ) {
    return this.supplierPayablesService.markPaid(payableId, principal.userId, dto);
  }
}
