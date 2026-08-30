import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { envValidationSchema } from './config/env.validation';
import { AuthModule } from './modules/auth/auth.module';
import { AuthenticationGuard } from './modules/auth/authentication.guard';
import { PermissionsGuard } from './modules/authorization/permissions.guard';
import { CatalogModule } from './modules/catalog/catalog.module';
import { FinanceModule } from './modules/finance/finance.module';
import { HealthModule } from './modules/health/health.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PricingModule } from './modules/pricing/pricing.module';
import { PlatingModule } from './modules/plating/plating.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { ProfileModule } from './modules/profile/profile.module';
import { ShippingModule } from './modules/shipping/shipping.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validationSchema: envValidationSchema,
      validationOptions: {
        libraryOptions: {
          allowUnknown: true,
          abortEarly: false,
        },
      },
    }),
    ScheduleModule.forRoot(),
    AuthModule,
    CatalogModule,
    FinanceModule,
    HealthModule,
    InventoryModule,
    NotificationsModule,
    PricingModule,
    PlatingModule,
    OrdersModule,
    PaymentsModule,
    ProfileModule,
    ShippingModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AuthenticationGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
  ],
})
export class AppModule {}
