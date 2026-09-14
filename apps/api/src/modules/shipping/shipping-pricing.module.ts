import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { ShippingPricingService } from './shipping-pricing.service';

@Module({
  imports: [DatabaseModule],
  providers: [ShippingPricingService],
  exports: [ShippingPricingService],
})
export class ShippingPricingModule {}
