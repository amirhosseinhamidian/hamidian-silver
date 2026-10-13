import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { CatalogModule } from '../catalog/catalog.module';
import { GuideController } from './guide.controller';
import { GuideService } from './guide.service';

@Module({
  imports: [DatabaseModule, CatalogModule],
  controllers: [GuideController],
  providers: [GuideService],
})
export class GuideModule {}
