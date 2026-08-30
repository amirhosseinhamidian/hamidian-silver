import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { MellatPaymentGateway } from './adapters/mellat-payment.gateway';
import { ZarinpalPaymentGateway } from './adapters/zarinpal-payment.gateway';
import { ZibalPaymentGateway } from './adapters/zibal-payment.gateway';
import { PAYMENT_GATEWAY } from './payment-gateway.port';
import { PaymentGatewaySettingsController } from './payment-gateway-settings.controller';
import { PAYMENT_GATEWAY_REGISTRY, PaymentGatewayRegistry } from './payment-gateway.registry';
import './payment-gateway.dto-metadata';
import { MellatPaymentCallbackController } from './mellat-payment-callback.controller';
import { MellatPaymentRedirectController } from './mellat-payment-redirect.controller';
import { PaymentsController } from './payments.controller';
import { ZibalPaymentCallbackController } from './zibal-payment-callback.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [DatabaseModule],
  controllers: [
    PaymentsController,
    PaymentGatewaySettingsController,
    ZibalPaymentCallbackController,
    MellatPaymentCallbackController,
    MellatPaymentRedirectController,
  ],
  providers: [
    PaymentsService,
    ZarinpalPaymentGateway,
    ZibalPaymentGateway,
    MellatPaymentGateway,
    PaymentGatewayRegistry,
    {
      provide: PAYMENT_GATEWAY_REGISTRY,
      useExisting: PaymentGatewayRegistry,
    },
    {
      provide: PAYMENT_GATEWAY,
      useExisting: PaymentGatewayRegistry,
    },
  ],
})
export class PaymentsModule {}
