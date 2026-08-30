import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { DisabledPaymentGateway } from './adapters/disabled-payment.gateway';
import { PAYMENT_GATEWAY } from './payment-gateway.port';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [DatabaseModule],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    DisabledPaymentGateway,
    {
      provide: PAYMENT_GATEWAY,
      useExisting: DisabledPaymentGateway,
    },
  ],
})
export class PaymentsModule {}
