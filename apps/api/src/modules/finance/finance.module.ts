import { Global, Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { PaymentRefundsController } from './payment-refunds.controller';
import { PaymentRefundsService } from './payment-refunds.service';
import { OrderFinanceController } from './order-finance.controller';
import { OrderFinanceService } from './order-finance.service';
import { SupplierCreditsController } from './supplier-credits.controller';
import { SupplierCreditsService } from './supplier-credits.service';
import { SupplierPayablesController } from './supplier-payables.controller';
import { SupplierPayablesService } from './supplier-payables.service';
import { SupplierSettlementsController } from './supplier-settlements.controller';
import { SupplierSettlementsService } from './supplier-settlements.service';

@Global()
@Module({
  imports: [DatabaseModule],
  controllers: [
    SupplierPayablesController,
    SupplierSettlementsController,
    OrderFinanceController,
    PaymentRefundsController,
    SupplierCreditsController,
  ],
  providers: [
    SupplierPayablesService,
    SupplierSettlementsService,
    OrderFinanceService,
    PaymentRefundsService,
    SupplierCreditsService,
  ],
  exports: [OrderFinanceService],
})
export class FinanceModule {}
