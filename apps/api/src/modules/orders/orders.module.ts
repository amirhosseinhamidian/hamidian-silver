import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { OrderExpirationScheduler } from './order-expiration.scheduler';
import { OrderExpirationService } from './order-expiration.service';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [DatabaseModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrderExpirationService, OrderExpirationScheduler],
  exports: [OrderExpirationService],
})
export class OrdersModule {}
