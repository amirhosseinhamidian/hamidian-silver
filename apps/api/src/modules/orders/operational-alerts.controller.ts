import { Controller, Get } from '@nestjs/common';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { PERMISSION_CODES } from '../authorization/rbac.constants';
import { OperationalAlertsService } from './operational-alerts.service';

@Controller('operations/alerts')
export class OperationalAlertsController {
  constructor(private readonly operationalAlertsService: OperationalAlertsService) {}

  @Get('summary')
  @RequirePermissions(PERMISSION_CODES.ORDERS_READ)
  summary() {
    return this.operationalAlertsService.summary();
  }
}
