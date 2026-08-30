import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { DisabledShippingProvider } from './adapters/disabled-shipping.provider';
import { SHIPPING_PROVIDER } from './shipping-provider.port';
import { ShippingController } from './shipping.controller';
import { ShippingService } from './shipping.service';

@Module({
  imports: [DatabaseModule],
  controllers: [ShippingController],
  providers: [
    ShippingService,
    DisabledShippingProvider,
    {
      provide: SHIPPING_PROVIDER,
      useExisting: DisabledShippingProvider,
    },
  ],
})
export class ShippingModule {}
