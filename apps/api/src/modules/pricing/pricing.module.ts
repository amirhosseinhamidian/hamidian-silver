import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { PricingController } from './pricing.controller';
import { PricingService } from './pricing.service';

@Module({
  imports: [DatabaseModule],
  controllers: [PricingController],
  providers: [PricingService],
})
export class PricingModule {}
