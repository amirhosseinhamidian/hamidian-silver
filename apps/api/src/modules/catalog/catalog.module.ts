import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { CatalogController } from './catalog.controller';
import { CatalogAttributesController } from './catalog-attributes.controller';
import { CatalogAttributesService } from './catalog-attributes.service';
import { CatalogCategoriesService } from './catalog-categories.service';
import { CatalogMediaService } from './catalog-media.service';
import { CatalogMerchandisingController } from './catalog-merchandising.controller';
import { CatalogMerchandisingService } from './catalog-merchandising.service';
import { CatalogReferencesService } from './catalog-references.service';
import { CatalogService } from './catalog.service';
import { CatalogVariantsService } from './catalog-variants.service';
import { LocalMediaStorageService } from './local-media-storage.service';
import { PublicMediaUrlService } from './public-media-url.service';

@Module({
  imports: [DatabaseModule],
  controllers: [CatalogController, CatalogAttributesController, CatalogMerchandisingController],
  providers: [
    CatalogService,
    CatalogAttributesService,
    CatalogCategoriesService,
    CatalogMediaService,
    CatalogMerchandisingService,
    CatalogReferencesService,
    CatalogVariantsService,
    LocalMediaStorageService,
    PublicMediaUrlService,
  ],
  exports: [CatalogMediaService, CatalogService, PublicMediaUrlService],
})
export class CatalogModule {}
