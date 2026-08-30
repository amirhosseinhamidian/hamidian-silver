import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { CurrentPrincipal } from '../auth/current-principal.decorator';
import type { AuthenticatedPrincipal } from '../authorization/authorization.types';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { PERMISSION_CODES } from '../authorization/rbac.constants';
import { CancelPaymentRefundDto } from './dto/cancel-payment-refund.dto';
import { ConfirmPaymentRefundDto } from './dto/confirm-payment-refund.dto';
import { CreatePaymentRefundDto } from './dto/create-payment-refund.dto';
import { ListPaymentRefundsQueryDto } from './dto/list-payment-refunds-query.dto';
import { PaymentRefundsService } from './payment-refunds.service';

@Controller('finance/refunds')
export class PaymentRefundsController {
  constructor(private readonly paymentRefundsService: PaymentRefundsService) {}

  @Get()
  @RequirePermissions(PERMISSION_CODES.FINANCE_READ)
  list(@Query() query: ListPaymentRefundsQueryDto) {
    return this.paymentRefundsService.list(query);
  }

  @Get(':refundId')
  @RequirePermissions(PERMISSION_CODES.FINANCE_READ)
  get(
    @Param('refundId', new ParseUUIDPipe({ version: '4' }))
    refundId: string,
  ) {
    return this.paymentRefundsService.get(refundId);
  }

  @Post()
  @RequirePermissions(PERMISSION_CODES.FINANCE_WRITE)
  create(
    @Body() dto: CreatePaymentRefundDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ) {
    return this.paymentRefundsService.create(principal.userId, dto);
  }

  @Post(':refundId/confirm')
  @RequirePermissions(PERMISSION_CODES.FINANCE_WRITE)
  confirm(
    @Param('refundId', new ParseUUIDPipe({ version: '4' }))
    refundId: string,
    @Body() dto: ConfirmPaymentRefundDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ) {
    return this.paymentRefundsService.confirm(refundId, principal.userId, dto);
  }

  @Post(':refundId/cancel')
  @RequirePermissions(PERMISSION_CODES.FINANCE_WRITE)
  cancel(
    @Param('refundId', new ParseUUIDPipe({ version: '4' }))
    refundId: string,
    @Body() dto: CancelPaymentRefundDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ) {
    return this.paymentRefundsService.cancel(refundId, principal.userId, dto);
  }
}
