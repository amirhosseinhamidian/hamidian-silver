import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { CurrentPrincipal } from '../auth/current-principal.decorator';
import type { AuthenticatedPrincipal } from '../authorization/authorization.types';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { PERMISSION_CODES } from '../authorization/rbac.constants';
import { ListPaymentReconciliationsQueryDto } from './dto/list-payment-reconciliations-query.dto';
import { ResolvePaymentReconciliationDto } from './dto/resolve-payment-reconciliation.dto';
import { PaymentReconciliationService } from './payment-reconciliation.service';

@Controller('payments/reconciliations')
export class PaymentReconciliationController {
  constructor(private readonly reconciliationService: PaymentReconciliationService) {}

  @Get()
  @RequirePermissions(PERMISSION_CODES.FINANCE_READ)
  list(@Query() query: ListPaymentReconciliationsQueryDto) {
    return this.reconciliationService.list(query.status);
  }

  @Patch(':reconciliationId/resolve-external-refund')
  @RequirePermissions(PERMISSION_CODES.FINANCE_WRITE)
  resolveExternalRefund(
    @Param('reconciliationId', new ParseUUIDPipe({ version: '4' }))
    reconciliationId: string,
    @Body() dto: ResolvePaymentReconciliationDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ) {
    return this.reconciliationService.resolveExternalRefund(
      reconciliationId,
      principal.userId,
      dto.resolutionNote,
    );
  }
}
