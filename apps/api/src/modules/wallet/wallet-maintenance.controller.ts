import { Controller, Get, Header, Query } from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { PERMISSION_CODES } from '../authorization/rbac.constants';
import {
  WalletMaintenanceQueryDto,
  WalletMaintenanceReportDto,
} from './dto/wallet-maintenance.dto';
import { WalletMaintenanceReportService } from './wallet-maintenance-report.service';

@Controller({ path: 'wallet/admin/maintenance', version: '1' })
export class WalletMaintenanceController {
  constructor(private readonly maintenance: WalletMaintenanceReportService) {}

  @Get('report')
  @Header('Cache-Control', 'private, no-store')
  @RequirePermissions(PERMISSION_CODES.FINANCE_READ)
  @ApiOkResponse({ type: WalletMaintenanceReportDto })
  report(@Query() query: WalletMaintenanceQueryDto) {
    return this.maintenance.report(query.page ?? 1, query.status ?? 'open');
  }
}
