import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { PERMISSION_CODES } from '../authorization/rbac.constants';
import { ListSupplierCreditsQueryDto } from './dto/list-supplier-credits-query.dto';
import { SupplierCreditsService } from './supplier-credits.service';

@Controller('finance/supplier-credits')
export class SupplierCreditsController {
  constructor(private readonly supplierCreditsService: SupplierCreditsService) {}

  @Get()
  @RequirePermissions(PERMISSION_CODES.FINANCE_READ)
  list(@Query() query: ListSupplierCreditsQueryDto) {
    return this.supplierCreditsService.list(query);
  }

  @Get(':creditId')
  @RequirePermissions(PERMISSION_CODES.FINANCE_READ)
  get(
    @Param('creditId', new ParseUUIDPipe({ version: '4' }))
    creditId: string,
  ) {
    return this.supplierCreditsService.get(creditId);
  }
}
