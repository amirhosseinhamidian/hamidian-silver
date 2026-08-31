import { Body, Controller, Get, Param, ParseUUIDPipe, Patch } from '@nestjs/common';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { PERMISSION_CODES } from '../authorization/rbac.constants';
import { ResolvePaymentInitiationRecoveryDto } from './dto/resolve-payment-initiation-recovery.dto';
import { PaymentInitiationRecoveryService } from './payment-initiation-recovery.service';

@Controller('payments/initiation-recovery')
export class PaymentInitiationRecoveryController {
  constructor(private readonly recoveryService: PaymentInitiationRecoveryService) {}

  @Get()
  @RequirePermissions(PERMISSION_CODES.FINANCE_READ)
  list() {
    return this.recoveryService.listCandidates();
  }

  @Patch(':attemptId/resolve')
  @RequirePermissions(PERMISSION_CODES.FINANCE_WRITE)
  resolve(
    @Param('attemptId', new ParseUUIDPipe({ version: '4' })) attemptId: string,
    @Body() dto: ResolvePaymentInitiationRecoveryDto,
  ) {
    return this.recoveryService.resolve(attemptId, dto);
  }
}
