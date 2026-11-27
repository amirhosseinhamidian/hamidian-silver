import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ShippingPricingModule } from '../shipping/shipping-pricing.module';
import { CatalogModule } from '../catalog/catalog.module';
import { PromotionsModule } from '../promotions/promotions.module';
import { WalletModule } from '../wallet/wallet.module';
import { FulfillmentReadinessController } from './fulfillment-readiness.controller';
import { FulfillmentReadinessService } from './fulfillment-readiness.service';
import { OperationsWorkQueueController } from './operations-work-queue.controller';
import { OperationsWorkQueueService } from './operations-work-queue.service';
import { OperationalAlertsController } from './operational-alerts.controller';
import { OperationalAlertsScheduler } from './operational-alerts.scheduler';
import { OperationalAlertsService } from './operational-alerts.service';
import { OperationalIncidentsController } from './operational-incidents.controller';
import { OperationalIncidentsService } from './operational-incidents.service';
import { OrderExpirationScheduler } from './order-expiration.scheduler';
import { OrderExpirationService } from './order-expiration.service';
import { OrderReturnsController } from './order-returns.controller';
import { OrderReturnsService } from './order-returns.service';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { CartRecoveryController } from './cart-recovery.controller';
import { CartRecoveryService } from './cart-recovery.service';
import { CartRecoveryScheduler } from './cart-recovery.scheduler';

@Module({
  imports: [
    DatabaseModule,
    NotificationsModule,
    CatalogModule,
    ShippingPricingModule,
    PromotionsModule,
    WalletModule,
  ],
  controllers: [
    OrdersController,
    CartRecoveryController,
    OrderReturnsController,
    FulfillmentReadinessController,
    OperationsWorkQueueController,
    OperationalAlertsController,
    OperationalIncidentsController,
  ],
  providers: [
    OrdersService,
    CartRecoveryService,
    CartRecoveryScheduler,
    OrderReturnsService,
    OrderExpirationService,
    OrderExpirationScheduler,
    FulfillmentReadinessService,
    OperationsWorkQueueService,
    OperationalAlertsService,
    OperationalIncidentsService,
    OperationalAlertsScheduler,
  ],
  exports: [OrderExpirationService],
})
export class OrdersModule {}
