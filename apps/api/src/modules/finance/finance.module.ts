import { Global, Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { OrderFinanceController } from './order-finance.controller';
import { OrderFinanceService } from './order-finance.service';
import { SupplierPayablesController } from './supplier-payables.controller';
import { SupplierPayablesService } from './supplier-payables.service';
import { SupplierSettlementsController } from './supplier-settlements.controller';
import { SupplierSettlementsService } from './supplier-settlements.service';

@Global()
@Module({
  imports: [DatabaseModule],
  controllers: [SupplierPayablesController, SupplierSettlementsController, OrderFinanceController],
  providers: [SupplierPayablesService, SupplierSettlementsService, OrderFinanceService],
  exports: [OrderFinanceService],
})
export class FinanceModule {}
