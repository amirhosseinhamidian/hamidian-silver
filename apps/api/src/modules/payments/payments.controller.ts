import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { CurrentPrincipal } from '../auth/current-principal.decorator';
import { Public } from '../auth/public.decorator';
import type { AuthenticatedPrincipal } from '../authorization/authorization.types';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { PaymentCallbackQueryDto } from './dto/payment-callback-query.dto';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('orders/:orderId/initiate')
  initiateOrderPayment(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('orderId', new ParseUUIDPipe({ version: '4' })) orderId: string,
    @Body() dto: InitiatePaymentDto,
  ) {
    return this.paymentsService.initiateOrderPayment(principal.userId, orderId, dto);
  }

  @Get('orders/:orderId')
  getOrderPayment(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('orderId', new ParseUUIDPipe({ version: '4' })) orderId: string,
  ) {
    return this.paymentsService.getOrderPayment(principal.userId, orderId);
  }

  @Public()
  @Get('callback/:attemptId')
  verifyCallback(
    @Param('attemptId', new ParseUUIDPipe({ version: '4' })) attemptId: string,
    @Query() query: PaymentCallbackQueryDto,
  ) {
    return this.paymentsService.verifyCallback(attemptId, query.authority);
  }
}
