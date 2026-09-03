import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { PublicMediaUrlService } from './public-media-url.service';

@Module({
  imports: [DatabaseModule],
  controllers: [CatalogController],
  providers: [CatalogService, PublicMediaUrlService],
})
export class CatalogModule {}
