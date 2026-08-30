import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { DisabledPaymentGateway } from './adapters/disabled-payment.gateway';
import { ZarinpalPaymentGateway } from './adapters/zarinpal-payment.gateway';
import { PAYMENT_GATEWAY, type PaymentGateway } from './payment-gateway.port';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [DatabaseModule],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    DisabledPaymentGateway,
    ZarinpalPaymentGateway,
    {
      provide: PAYMENT_GATEWAY,
      inject: [ConfigService, DisabledPaymentGateway, ZarinpalPaymentGateway],
      useFactory: (
        config: ConfigService,
        disabledGateway: DisabledPaymentGateway,
        zarinpalGateway: ZarinpalPaymentGateway,
      ): PaymentGateway =>
        config.get<string>('PAYMENT_PROVIDER', 'disabled') === 'zarinpal'
          ? zarinpalGateway
          : disabledGateway,
    },
  ],
})
export class PaymentsModule {}
