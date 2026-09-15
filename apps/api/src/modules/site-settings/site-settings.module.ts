import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../infrastructure/database/database.module';
import { CatalogModule } from '../catalog/catalog.module';
import { SiteSettingsController } from './site-settings.controller';
import { HomepageService } from './homepage.service';
import { SiteSettingsService } from './site-settings.service';
import { ContentPagesService } from './content-pages.service';

@Module({
  imports: [DatabaseModule, CatalogModule],
  controllers: [SiteSettingsController],
  providers: [ContentPagesService, HomepageService, SiteSettingsService],
  exports: [ContentPagesService, HomepageService, SiteSettingsService],
})
export class SiteSettingsModule {}
