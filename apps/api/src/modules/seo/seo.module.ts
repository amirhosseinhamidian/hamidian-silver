import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { CatalogModule } from '../catalog/catalog.module';
import { SeoController } from './seo.controller';
import { SeoRedirectsService } from './seo-redirects.service';
import { SeoSitemapService } from './seo-sitemap.service';
import {
  GoogleSearchConsoleClient,
  SEARCH_CONSOLE_CLIENT,
} from './search-console/google-search-console.client';
import { SearchConsoleController } from './search-console/search-console.controller';
import { SearchConsoleSyncStore } from './search-console/search-console-sync.store';
import { SearchConsoleSyncWorker } from './search-console/search-console-sync.worker';
import { SearchConsoleService } from './search-console/search-console.service';
import { SearchOverviewController } from './search-console/search-overview.controller';
import { SearchOverviewService } from './search-console/search-overview.service';

@Module({
  imports: [DatabaseModule, CatalogModule],
  controllers: [SeoController, SearchConsoleController, SearchOverviewController],
  providers: [
    SeoRedirectsService,
    SeoSitemapService,
    SearchConsoleService,
    SearchConsoleSyncStore,
    SearchConsoleSyncWorker,
    SearchOverviewService,
    {
      provide: SEARCH_CONSOLE_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new GoogleSearchConsoleClient({
          property: config.get<string>('SEARCH_CONSOLE_PROPERTY'),
          credentialsFile: config.get<string>('SEARCH_CONSOLE_CREDENTIALS_FILE'),
        }),
    },
  ],
  exports: [SearchConsoleService],
})
export class SeoModule {}
