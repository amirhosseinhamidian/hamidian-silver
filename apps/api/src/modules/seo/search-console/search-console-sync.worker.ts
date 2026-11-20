import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SEARCH_CONSOLE_CLIENT, type SearchConsoleClient } from './google-search-console.client';
import {
  fetchDailyMetrics,
  searchConsoleDay,
  type SyncSearchType,
} from './search-console-sync-data';
import { SearchConsoleSyncStore } from './search-console-sync.store';
import { SearchConsoleService } from './search-console.service';

@Injectable()
export class SearchConsoleSyncWorker {
  private readonly logger = new Logger(SearchConsoleSyncWorker.name);
  private readonly enabled: boolean;
  private readonly historyDays: number;
  private readonly searchTypes: SyncSearchType[];

  constructor(
    config: ConfigService,
    @Inject(SEARCH_CONSOLE_CLIENT) private readonly client: SearchConsoleClient,
    private readonly service: SearchConsoleService,
    private readonly store: SearchConsoleSyncStore,
  ) {
    this.enabled = config.get<boolean>('SEARCH_CONSOLE_SYNC_ENABLED', false) === true;
    this.historyDays = config.get<number>('SEARCH_CONSOLE_SYNC_HISTORY_DAYS', 30);
    this.searchTypes = [
      ...new Set(config.get<string>('SEARCH_CONSOLE_SYNC_SEARCH_TYPES', 'web').split(',')),
    ].sort() as SyncSearchType[];
    if (this.enabled && !this.client.property) {
      this.logger.warn('Search Console sync requires a supported property identifier.');
    }
  }

  @Cron(CronExpression.EVERY_MINUTE, { name: 'search-console-sync', waitForCompletion: true })
  async tick() {
    if (!this.enabled || !this.client.property) return;
    try {
      const integrationId = await this.store.plan(
        this.client.property,
        searchConsoleDay(new Date()),
        this.historyDays,
        this.searchTypes,
      );
      const run = await this.store.claim(integrationId, new Date());
      if (!run) return;
      try {
        const data = await fetchDailyMetrics(
          this.service,
          this.client.property,
          run.metricDate,
          run.searchType as SyncSearchType,
        );
        await this.store.complete(run, data);
      } catch (error) {
        await this.store.fail(run, error);
      }
    } catch {
      // The lease will allow another tick to resume if processing could not be recorded.
      this.logger.warn('Search Console sync could not update its queue.');
    }
  }
}
