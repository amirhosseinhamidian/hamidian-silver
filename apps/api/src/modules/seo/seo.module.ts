import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { CatalogModule } from '../catalog/catalog.module';
import { SeoAuditController } from './audit/seo-audit.controller';
import { SeoAuditService } from './audit/seo-audit.service';
import { SeoIndexMonitoringController } from './inspection/seo-index-monitoring.controller';
import { SeoIndexMonitoringService } from './inspection/seo-index-monitoring.service';
import { SeoInspectionStore } from './inspection/seo-inspection-store';
import { SeoIssueController } from './issues/seo-issue.controller';
import { SeoIssueService } from './issues/seo-issue.service';
import { SeoIssueDeliveryWorker } from './issues/seo-issue-delivery.worker';
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
import { SearchEntityController } from './search-console/search-entity.controller';
import { SearchEntityService } from './search-console/search-entity.service';

@Module({
  imports: [DatabaseModule, CatalogModule],
  controllers: [
    SeoController,
    SearchConsoleController,
    SearchOverviewController,
    SearchEntityController,
    SeoAuditController,
    SeoIndexMonitoringController,
    SeoIssueController,
  ],
  providers: [
    SeoRedirectsService,
    SeoSitemapService,
    SearchConsoleService,
    SearchConsoleSyncStore,
    SearchConsoleSyncWorker,
    SearchOverviewService,
    SearchEntityService,
    SeoAuditService,
    SeoIndexMonitoringService,
    SeoInspectionStore,
    SeoIssueService,
    SeoIssueDeliveryWorker,
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
