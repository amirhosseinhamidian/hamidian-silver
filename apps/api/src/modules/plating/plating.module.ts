import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { FinanceModule } from '../finance/finance.module';
import { PlatingFulfillmentController } from './plating-fulfillment.controller';
import { PlatingFulfillmentService } from './plating-fulfillment.service';
import { PlatingController } from './plating.controller';
import { PlatingService } from './plating.service';

@Module({
  imports: [DatabaseModule, FinanceModule],
  controllers: [PlatingController, PlatingFulfillmentController],
  providers: [PlatingService, PlatingFulfillmentService],
})
export class PlatingModule {}
