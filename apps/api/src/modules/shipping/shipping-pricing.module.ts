import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { CatalogModule } from '../catalog/catalog.module';
import { ShippingPricingService } from './shipping-pricing.service';
import { ShippingCarriersService } from './shipping-carriers.service';

@Module({
  imports: [DatabaseModule, CatalogModule],
  providers: [ShippingPricingService, ShippingCarriersService],
  exports: [ShippingPricingService, ShippingCarriersService],
})
export class ShippingPricingModule {}
