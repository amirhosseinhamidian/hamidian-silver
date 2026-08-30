import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { ZibalPaymentCallbackQueryDto } from './dto/zibal-payment-callback-query.dto';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class ZibalPaymentCallbackController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Public()
  @Get('callback/:attemptId/zibal')
  verifyCallback(
    @Param('attemptId', new ParseUUIDPipe({ version: '4' })) attemptId: string,
    @Query() query: ZibalPaymentCallbackQueryDto,
  ) {
    return this.paymentsService.verifyCallback(attemptId, query.trackId);
  }
}
