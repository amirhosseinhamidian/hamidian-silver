import { Controller, Get, Query } from '@nestjs/common';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { PERMISSION_CODES } from '../authorization/rbac.constants';
import { FinancePeriodQueryDto } from './dto/finance-period-query.dto';
import { FinancialReportingService } from './financial-reporting.service';

@Controller('finance')
export class FinancialReportingController {
  constructor(private readonly financialReportingService: FinancialReportingService) {}

  @Get('dashboard/management')
  @RequirePermissions(PERMISSION_CODES.FINANCE_READ)
  managementDashboard(@Query() query: FinancePeriodQueryDto) {
    return this.financialReportingService.managementDashboard(query);
  }

  @Get('dashboard/suppliers')
  @RequirePermissions(PERMISSION_CODES.FINANCE_READ)
  suppliers(@Query() query: FinancePeriodQueryDto) {
    return this.financialReportingService.suppliers(query);
  }

  @Get('dashboard/contribution')
  @RequirePermissions(PERMISSION_CODES.FINANCE_READ)
  contribution(@Query() query: FinancePeriodQueryDto) {
    return this.financialReportingService.contribution(query);
  }

  @Get('cashflow')
  @RequirePermissions(PERMISSION_CODES.FINANCE_READ)
  cashflow(@Query() query: FinancePeriodQueryDto) {
    return this.financialReportingService.cashflow(query);
  }
}
