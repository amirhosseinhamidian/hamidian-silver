import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { CatalogController } from './catalog.controller';
import { CatalogCategoriesService } from './catalog-categories.service';
import { CatalogMediaService } from './catalog-media.service';
import { CatalogReferencesService } from './catalog-references.service';
import { CatalogService } from './catalog.service';
import { CatalogVariantsService } from './catalog-variants.service';
import { LocalMediaStorageService } from './local-media-storage.service';
import { PublicMediaUrlService } from './public-media-url.service';

@Module({
  imports: [DatabaseModule],
  controllers: [CatalogController],
  providers: [
    CatalogService,
    CatalogCategoriesService,
    CatalogMediaService,
    CatalogReferencesService,
    CatalogVariantsService,
    LocalMediaStorageService,
    PublicMediaUrlService,
  ],
  exports: [CatalogService, PublicMediaUrlService],
})
export class CatalogModule {}
