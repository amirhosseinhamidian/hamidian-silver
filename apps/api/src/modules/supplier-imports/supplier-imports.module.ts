import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { BsjSilverCrawlerAdapter } from './adapters/bsj-silver-crawler.adapter';
import { SupplierImportsController } from './supplier-imports.controller';
import { SupplierImportsService } from './supplier-imports.service';

@Module({
  imports: [DatabaseModule],
  controllers: [SupplierImportsController],
  providers: [SupplierImportsService, BsjSilverCrawlerAdapter],
})
export class SupplierImportsModule {}
