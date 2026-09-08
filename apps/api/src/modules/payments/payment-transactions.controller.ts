import { Controller, Get, Query } from '@nestjs/common';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { PERMISSION_CODES } from '../authorization/rbac.constants';
import { ListPaymentAttemptsQueryDto } from './dto/list-payment-attempts-query.dto';
import { PaymentTransactionsService } from './payment-transactions.service';

@Controller('payments/attempts')
export class PaymentTransactionsController {
  constructor(private readonly transactionsService: PaymentTransactionsService) {}

  @Get()
  @RequirePermissions(PERMISSION_CODES.FINANCE_READ)
  list(@Query() query: ListPaymentAttemptsQueryDto) {
    return this.transactionsService.list(query);
  }
}
