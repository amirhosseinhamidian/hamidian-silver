import { Body, Controller, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { MellatPaymentCallbackDto } from './dto/mellat-payment-callback.dto';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class MellatPaymentCallbackController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Public()
  @Post('callback/:attemptId/mellat')
  verifyCallback(
    @Param('attemptId', new ParseUUIDPipe({ version: '4' }))
    attemptId: string,
    @Body() body: MellatPaymentCallbackDto,
  ) {
    const callbackData: Record<string, string> = {
      attemptId,
      resCode: body.ResCode,
    };

    if (body.SaleOrderId) {
      callbackData.saleOrderId = body.SaleOrderId;
    }

    if (body.SaleReferenceId) {
      callbackData.saleReferenceId = body.SaleReferenceId;
    }

    return this.paymentsService.verifyCallback(attemptId, body.RefId, callbackData);
  }
}
