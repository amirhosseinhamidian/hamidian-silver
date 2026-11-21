import { BadRequestException, HttpException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SeoSyncStatus } from '../../../generated/prisma/enums';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type {
  SearchOverviewDto,
  SearchOverviewPeriodDto,
  SearchOverviewQueryDto,
  SearchOverviewRowsDto,
  SearchOverviewRowsQueryDto,
  SearchOverviewSyncDto,
} from '../dto/search-overview.dto';
import { SEARCH_CONSOLE_CLIENT, type SearchConsoleClient } from './google-search-console.client';
import { SEARCH_CONSOLE_ERROR_CODES } from './search-console-errors';
import { aggregateDailyMetrics, dayLabel, shiftDay } from './search-console-sync-data';
import {
  overviewDaysQuery,
  overviewRowsQuery,
  type OverviewDayRow,
  type OverviewTableRow,
} from './search-overview-query';

type Cache<T> = Map<string, { expiresAt: number; result: Promise<T> }>;
const cacheLifetimeMs = 30_000;
const maxCacheEntries = 48;
const dayMs = 86_400_000;

function cached<T>(cache: Cache<T>, key: string, read: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const existing = cache.get(key);
  if (existing && existing.expiresAt > now) return existing.result;
  cache.delete(key);
  if (cache.size >= maxCacheEntries) cache.delete(cache.keys().next().value!);
  const result = read().catch((error: unknown) => {
    if (cache.get(key)?.result === result) cache.delete(key);
    throw error;
  });
  cache.set(key, { expiresAt: now + cacheLifetimeMs, result });
  return result;
}

function calendar(query: SearchOverviewQueryDto) {
  const first = new Date(`${query.startDate}T00:00:00Z`);
  const last = new Date(`${query.endDate}T00:00:00Z`);
  const days = (last.valueOf() - first.valueOf()) / dayMs + 1;
  if (
    !Number.isInteger(days) ||
    days < 1 ||
    days > 90 ||
    dayLabel(first) !== query.startDate ||
    dayLabel(last) !== query.endDate
  ) {
    throw new BadRequestException('Choose a valid report period of at most 90 calendar days.');
  }
  const searchType = query.searchType ?? 'web';
  if (query.brand && (query.device || searchType !== 'web')) {
    throw new BadRequestException('Brand data is only available for Web without a device filter.');
  }
  return { first, last, days, previousFirst: shiftDay(first, -days), searchType };
}

function period(days: readonly SearchOverviewPeriodDto[]): SearchOverviewPeriodDto {
  const observed = days.flatMap((day) => (day.metrics ? [day.metrics] : []));
  return {
    startDate: days[0].startDate,
    endDate: days[days.length - 1].endDate,
    days: days.length,
    dataDays: observed.length,
    syncedDays: days.reduce((sum, day) => sum + day.syncedDays, 0),
    metrics: aggregateDailyMetrics(observed),
  };
}

function dailySeries(first: Date, length: number, rows: OverviewDayRow[]) {
  const byDate = new Map(rows.map((row) => [row.date, row]));
  return Array.from({ length }, (_, index): SearchOverviewPeriodDto => {
    const date = dayLabel(shiftDay(first, index));
    const row = byDate.get(date);
    const metrics =
      row && row.clicks !== null && row.impressions !== null
        ? aggregateDailyMetrics([
            {
              clicks: row.clicks,
              impressions: row.impressions,
              averagePosition: row.averagePosition,
            },
          ])
        : null;
    return {
      startDate: date,
      endDate: date,
      days: 1,
      syncedDays: row ? 1 : 0,
      dataDays: metrics ? 1 : 0,
      metrics,
    };
  });
}

function changes(current: SearchOverviewPeriodDto, previous: SearchOverviewPeriodDto) {
  if (
    current.dataDays !== current.days ||
    previous.dataDays !== previous.days ||
    !current.metrics ||
    !previous.metrics
  )
    return null;
  const now = current.metrics;
  const before = previous.metrics;
  return {
    clicks: now.clicks - before.clicks,
    impressions: now.impressions - before.impressions,
    ctr: now.ctr === null || before.ctr === null ? null : now.ctr - before.ctr,
    averagePosition:
      now.averagePosition === null || before.averagePosition === null
        ? null
        : now.averagePosition - before.averagePosition,
  };
}

@Injectable()
export class SearchOverviewService {
  private readonly overviewCache: Cache<SearchOverviewDto> = new Map();
  private readonly rowsCache: Cache<SearchOverviewRowsDto> = new Map();
  private activeRows = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(SEARCH_CONSOLE_CLIENT) private readonly client: SearchConsoleClient,
  ) {}

  overview(query: SearchOverviewQueryDto) {
    const dates = calendar(query);
    const key = JSON.stringify([
      query.startDate,
      query.endDate,
      dates.searchType,
      query.device,
      query.brand,
    ]);
    return cached(this.overviewCache, key, async () => {
      const property = this.client.property || null;
      const { searchType, previousFirst, last, days } = dates;
      const enabled = this.config.get<boolean>('SEARCH_CONSOLE_SYNC_ENABLED', false) === true;
      const scheduledForType = this.config
        .get<string>('SEARCH_CONSOLE_SYNC_SEARCH_TYPES', 'web')
        .split(',')
        .includes(searchType);
      const initialSync: SearchOverviewSyncDto = {
        enabled,
        scheduledForType,
        lastSuccessAt: null,
        latestSyncedDate: null,
        pausedUntil: null,
        lastRunStatus: null,
        lastErrorCode: null,
      };
      const result = property
        ? await this.prisma.$transaction(
            async (db) => {
              const integration = await db.seoIntegration.findUnique({
                where: { property },
                select: { id: true, pausedUntil: true },
              });
              if (!integration) return { rows: [], sync: initialSync };
              const filter = { integrationId: integration.id, searchType };
              const success = { ...filter, status: SeoSyncStatus.SUCCEEDED };
              const [lastSuccess, newestDay, lastAttempt, rows] = await Promise.all([
                db.seoSyncRun.findFirst({
                  where: success,
                  orderBy: { finishedAt: { sort: 'desc', nulls: 'last' } },
                  select: { finishedAt: true },
                }),
                db.seoSyncRun.findFirst({
                  where: success,
                  orderBy: { metricDate: 'desc' },
                  select: { metricDate: true },
                }),
                db.seoSyncRun.findFirst({
                  where: { ...filter, startedAt: { not: null } },
                  orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
                  select: { errorCode: true, status: true },
                }),
                db.$queryRaw<OverviewDayRow[]>(
                  overviewDaysQuery(
                    {
                      ...filter,
                      startDate: dayLabel(previousFirst),
                      endDate: dayLabel(last),
                    },
                    query,
                  ),
                ),
              ]);
              const errorCode = lastAttempt?.errorCode;
              return {
                rows,
                sync: {
                  ...initialSync,
                  lastSuccessAt: lastSuccess?.finishedAt?.toISOString() ?? null,
                  latestSyncedDate: newestDay ? dayLabel(newestDay.metricDate) : null,
                  pausedUntil: integration.pausedUntil?.toISOString() ?? null,
                  lastRunStatus: lastAttempt?.status ?? null,
                  lastErrorCode: errorCode
                    ? (SEARCH_CONSOLE_ERROR_CODES as readonly string[]).includes(errorCode)
                      ? errorCode
                      : 'sync_failed'
                    : null,
                },
              };
            },
            { isolationLevel: 'RepeatableRead', timeout: 10_000 },
          )
        : { rows: [], sync: initialSync };
      const timeline = dailySeries(previousFirst, days * 2, result.rows);
      const daily = timeline.slice(days);
      const current = period(daily);
      const previous = period(timeline.slice(0, days));
      const weekly = Array.from({ length: Math.ceil(days / 7) }, (_, index) =>
        period(daily.slice(index * 7, index * 7 + 7)),
      );
      return {
        property,
        searchType,
        scope: query.brand ? 'brand' : query.device ? 'device' : 'property',
        timeZone: 'America/Los_Angeles',
        sync: result.sync,
        current,
        previous,
        change: changes(current, previous),
        daily,
        weekly,
      };
    });
  }

  rows(query: SearchOverviewRowsQueryDto) {
    const { searchType } = calendar(query);
    if (query.q?.includes('\0')) throw new BadRequestException('Invalid search text.');
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const available = !query.brand && !(query.device && query.kind === 'query');
    const defaults: SearchOverviewRowsDto = {
      kind: query.kind,
      available,
      aggregation: query.kind === 'query' ? 'byProperty' : 'byPage',
      syncedDays: 0,
      cappedDays: 0,
      items: [],
      page,
      limit,
      total: 0,
    };
    if (!available || !this.client.property) return Promise.resolve(defaults);
    const key = JSON.stringify([
      query.startDate,
      query.endDate,
      searchType,
      query.device,
      query.kind,
      query.q?.trim(),
      query.sort ?? 'clicks',
      query.direction ?? 'desc',
      page,
      limit,
    ]);
    return cached(this.rowsCache, key, async () => {
      if (this.activeRows >= 4) throw new HttpException('Search overview is busy.', 429);
      this.activeRows++;
      try {
        return await this.prisma.$transaction(
          async (db) => {
            const integration = await db.seoIntegration.findUnique({
              where: { property: this.client.property },
              select: { id: true },
            });
            if (!integration) return defaults;
            const [result] = await db.$queryRaw<OverviewTableRow[]>(
              overviewRowsQuery(
                {
                  integrationId: integration.id,
                  searchType,
                  startDate: query.startDate,
                  endDate: query.endDate,
                },
                query,
                page,
                limit,
              ),
            );
            return { ...defaults, ...result };
          },
          { isolationLevel: 'RepeatableRead', timeout: 10_000 },
        );
      } finally {
        this.activeRows--;
      }
    });
  }
}
