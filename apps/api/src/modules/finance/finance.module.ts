import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { SupplierPayablesController } from './supplier-payables.controller';
import { SupplierPayablesService } from './supplier-payables.service';
import { SupplierSettlementsController } from './supplier-settlements.controller';
import { SupplierSettlementsService } from './supplier-settlements.service';

@Module({
  imports: [DatabaseModule],
  controllers: [SupplierPayablesController, SupplierSettlementsController],
  providers: [SupplierPayablesService, SupplierSettlementsService],
})
export class FinanceModule {}
