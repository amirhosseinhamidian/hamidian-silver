import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { FulfillmentReadinessController } from './fulfillment-readiness.controller';
import { FulfillmentReadinessService } from './fulfillment-readiness.service';
import { OrderExpirationScheduler } from './order-expiration.scheduler';
import { OrderExpirationService } from './order-expiration.service';
import { OrderReturnsController } from './order-returns.controller';
import { OrderReturnsService } from './order-returns.service';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [DatabaseModule],
  controllers: [OrdersController, OrderReturnsController, FulfillmentReadinessController],
  providers: [
    OrdersService,
    OrderReturnsService,
    OrderExpirationService,
    OrderExpirationScheduler,
    FulfillmentReadinessService,
  ],
  exports: [OrderExpirationService],
})
export class OrdersModule {}
