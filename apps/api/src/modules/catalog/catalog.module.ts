import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { CatalogController } from './catalog.controller';
import { CatalogMediaService } from './catalog-media.service';
import { CatalogService } from './catalog.service';
import { LocalMediaStorageService } from './local-media-storage.service';
import { PublicMediaUrlService } from './public-media-url.service';

@Module({
  imports: [DatabaseModule],
  controllers: [CatalogController],
  providers: [
    CatalogService,
    CatalogMediaService,
    LocalMediaStorageService,
    PublicMediaUrlService,
  ],
})
export class CatalogModule {}
