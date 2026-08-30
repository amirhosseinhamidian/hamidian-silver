import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { DisabledShippingProvider } from './adapters/disabled-shipping.provider';
import { PostexShippingProvider } from './adapters/postex-shipping.provider';
import { SHIPPING_PROVIDER, type ShippingProvider } from './shipping-provider.port';
import { ShippingController } from './shipping.controller';
import { ShippingTrackingScheduler } from './shipping-tracking.scheduler';
import { ShippingService } from './shipping.service';

@Module({
  imports: [DatabaseModule],
  controllers: [ShippingController],
  providers: [
    ShippingService,
    ShippingTrackingScheduler,
    DisabledShippingProvider,
    PostexShippingProvider,
    {
      provide: SHIPPING_PROVIDER,
      inject: [ConfigService, DisabledShippingProvider, PostexShippingProvider],
      useFactory: (
        config: ConfigService,
        disabledProvider: DisabledShippingProvider,
        postexProvider: PostexShippingProvider,
      ): ShippingProvider =>
        config.get<string>('SHIPPING_PROVIDER', 'disabled') === 'postex'
          ? postexProvider
          : disabledProvider,
    },
  ],
})
export class ShippingModule {}
