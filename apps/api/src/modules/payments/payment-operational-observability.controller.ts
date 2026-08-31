import { Controller, Get } from '@nestjs/common';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { PERMISSION_CODES } from '../authorization/rbac.constants';
import { PaymentOperationalObservabilityService } from './payment-operational-observability.service';

@Controller('payments/operations')
export class PaymentOperationalObservabilityController {
  constructor(private readonly observabilityService: PaymentOperationalObservabilityService) {}

  @Get('summary')
  @RequirePermissions(PERMISSION_CODES.FINANCE_READ)
  summary() {
    return this.observabilityService.summary();
  }
}
