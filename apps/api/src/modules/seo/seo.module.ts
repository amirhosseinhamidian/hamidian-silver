import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { CatalogModule } from '../catalog/catalog.module';
import { SeoController } from './seo.controller';
import { SeoRedirectsService } from './seo-redirects.service';
import { SeoSitemapService } from './seo-sitemap.service';

@Module({
  imports: [DatabaseModule, CatalogModule],
  controllers: [SeoController],
  providers: [SeoRedirectsService, SeoSitemapService],
})
export class SeoModule {}
