import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { MellatPaymentGateway } from './adapters/mellat-payment.gateway';
import { ZarinpalPaymentGateway } from './adapters/zarinpal-payment.gateway';
import { ZibalPaymentGateway } from './adapters/zibal-payment.gateway';
import { PAYMENT_GATEWAY } from './payment-gateway.port';
import { PaymentGatewaySettingsController } from './payment-gateway-settings.controller';
import { PAYMENT_GATEWAY_REGISTRY, PaymentGatewayRegistry } from './payment-gateway.registry';
import { MellatPaymentCallbackController } from './mellat-payment-callback.controller';
import { MellatPaymentRedirectController } from './mellat-payment-redirect.controller';
import { PaymentInitiationRecoveryController } from './payment-initiation-recovery.controller';
import { PaymentInitiationRecoveryPolicy } from './payment-initiation-recovery-policy';
import { PaymentInitiationRecoveryService } from './payment-initiation-recovery.service';
import { PaymentOperationalObservabilityController } from './payment-operational-observability.controller';
import { PaymentOperationalObservabilityScheduler } from './payment-operational-observability.scheduler';
import { PaymentOperationalObservabilityService } from './payment-operational-observability.service';
import { PaymentReconciliationController } from './payment-reconciliation.controller';
import { PaymentReconciliationService } from './payment-reconciliation.service';
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
    PaymentInitiationRecoveryController,
    PaymentOperationalObservabilityController,
    PaymentReconciliationController,
  ],
  providers: [
    PaymentsService,
    ZarinpalPaymentGateway,
    ZibalPaymentGateway,
    MellatPaymentGateway,
    PaymentGatewayRegistry,
    PaymentInitiationRecoveryPolicy,
    PaymentInitiationRecoveryService,
    PaymentOperationalObservabilityService,
    PaymentOperationalObservabilityScheduler,
    PaymentReconciliationService,
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
