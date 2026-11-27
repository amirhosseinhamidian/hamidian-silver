import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type {
  SearchConsoleBrandPerformanceDto,
  SearchConsoleConnectionDto,
  SearchConsolePerformanceDto,
  SearchConsolePerformanceQueryDto,
  SearchConsolePeriodDto,
  SearchConsoleRowDto,
  SearchConsoleSitemapsDto,
} from '../dto/search-console.dto';
import {
  SEARCH_CONSOLE_CLIENT,
  type GoogleSearchAnalyticsQuery,
  type SearchConsoleClient,
} from './google-search-console.client';
import { SearchConsoleError, searchConsoleRecord } from './search-console-errors';

const brandDataSince = '2026-02-21';
const brandPattern = '(?i)(hamidian|حم[یي]د[یي]ان)';

function calendarDate(value: string) {
  if (!/^[1-9]\d{3}-\d{2}-\d{2}$/.test(value)) return NaN;
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value
    ? timestamp
    : NaN;
}

function validatePeriod(period: SearchConsolePeriodDto) {
  const days = (calendarDate(period.endDate) - calendarDate(period.startDate)) / 86_400_000;
  if (!Number.isFinite(days) || days < 0 || days >= 93) {
    throw new BadRequestException('Select a valid Search Console period of at most 93 days.');
  }
}

function toGoogleQuery(input: SearchConsolePerformanceQueryDto): GoogleSearchAnalyticsQuery {
  validatePeriod(input);
  const dimensions = input.dimensions ?? [];
  const filters = (input.filters ?? []).map(({ dimension, operator, expression }) => {
    if (!expression.trim())
      throw new BadRequestException('Search Console filters require a value.');
    if (dimension === 'device') {
      const device = expression.toUpperCase();
      if (operator !== 'equals' || !['DESKTOP', 'MOBILE', 'TABLET'].includes(device)) {
        throw new BadRequestException(
          'Device filters require equals with DESKTOP, MOBILE or TABLET.',
        );
      }
      return { dimension, operator, expression: device };
    }
    return { dimension, operator, expression };
  });
  const type = input.searchType ?? 'web';
  const aggregationType = input.aggregation ?? 'auto';
  if (
    aggregationType !== 'auto' &&
    (dimensions.includes('page') || filters.some(({ dimension }) => dimension === 'page'))
  ) {
    throw new BadRequestException('Page dimensions require automatic Search Console aggregation.');
  }
  if (aggregationType === 'byProperty' && (type === 'discover' || type === 'googleNews')) {
    throw new BadRequestException('This search type requires page or automatic aggregation.');
  }
  if (dimensions.length !== new Set(dimensions).size)
    throw new BadRequestException('Search Console dimensions must be unique.');
  return {
    startDate: input.startDate,
    endDate: input.endDate,
    dimensions,
    type,
    aggregationType,
    rowLimit: input.rowLimit ?? 1000,
    startRow: input.startRow ?? 0,
    dataState: 'final',
    ...(filters.length > 0 ? { dimensionFilterGroups: [{ groupType: 'and', filters }] } : {}),
  };
}

function records(value: unknown, key: string): unknown[] {
  const payload = searchConsoleRecord(value);
  if (!payload || (payload[key] !== undefined && !Array.isArray(payload[key]))) {
    throw new SearchConsoleError('invalid_response');
  }
  return Array.isArray(payload[key]) ? payload[key] : [];
}

function readRows(response: unknown, dimensions: number): SearchConsoleRowDto[] {
  return records(response, 'rows').map((entry) => {
    const row = searchConsoleRecord(entry);
    const { clicks, impressions, ctr, position, keys = [] } = row ?? {};
    if (
      typeof clicks !== 'number' ||
      !Number.isFinite(clicks) ||
      clicks < 0 ||
      typeof impressions !== 'number' ||
      !Number.isFinite(impressions) ||
      impressions < 0 ||
      typeof ctr !== 'number' ||
      !Number.isFinite(ctr) ||
      ctr < 0 ||
      ctr > 1 ||
      (position != null &&
        (typeof position !== 'number' || !Number.isFinite(position) || position < 0)) ||
      !Array.isArray(keys) ||
      keys.length !== dimensions ||
      !keys.every((value) => typeof value === 'string')
    ) {
      throw new SearchConsoleError('invalid_response');
    }
    return {
      keys: [...keys] as string[],
      clicks,
      impressions,
      ctr,
      averagePosition: typeof position === 'number' ? position : null,
    };
  });
}

function metrics(row: SearchConsoleRowDto | undefined) {
  return row
    ? {
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        averagePosition: row.averagePosition,
      }
    : null;
}

function optionalCount(value: unknown) {
  const count = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  return typeof count === 'number' && Number.isSafeInteger(count) && count >= 0 ? count : null;
}

function optionalTimestamp(value: unknown) {
  const timestamp = typeof value === 'string' ? Date.parse(value) : NaN;
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function sitemapUrl(value: unknown) {
  if (typeof value !== 'string') throw new SearchConsoleError('invalid_response');
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error();
    return `${url.origin}${url.pathname}`;
  } catch {
    throw new SearchConsoleError('invalid_response');
  }
}

@Injectable()
export class SearchConsoleService {
  constructor(@Inject(SEARCH_CONSOLE_CLIENT) private readonly client: SearchConsoleClient) {}

  async connection(): Promise<SearchConsoleConnectionDto> {
    try {
      await this.client.checkAccess();
      return { property: this.client.property, status: 'connected' };
    } catch (error) {
      if (!(error instanceof SearchConsoleError)) throw error;
      return {
        property: this.client.property,
        status: 'unavailable',
        reason: error.code,
        message: error.message,
      };
    }
  }

  async performance(input: SearchConsolePerformanceQueryDto): Promise<SearchConsolePerformanceDto> {
    const query = toGoogleQuery(input);
    const response = await this.client.query(query);
    const rows = readRows(response, query.dimensions.length);
    const aggregation = searchConsoleRecord(response)?.responseAggregationType;
    const filters = input.filters ?? [];
    const dimensions = input.dimensions ?? [];
    const pageAggregate =
      aggregation === 'byPage' ||
      query.aggregationType === 'byPage' ||
      query.type === 'discover' ||
      query.type === 'googleNews';
    const next = query.startRow + query.rowLimit;
    return {
      property: this.client.property,
      rows,
      dimensions,
      searchType: input.searchType ?? 'web',
      aggregation:
        aggregation === 'auto' || aggregation === 'byPage' || aggregation === 'byProperty'
          ? aggregation
          : null,
      scope: dimensions.length
        ? 'grouped_rows'
        : filters.length
          ? 'filtered_total'
          : pageAggregate
            ? 'page_total'
            : 'property_total',
      nextStartRow:
        dimensions.length && rows.length === query.rowLimit && next <= 2_147_483_647 ? next : null,
    };
  }

  async brandPerformance(
    period: SearchConsolePeriodDto,
  ): Promise<SearchConsoleBrandPerformanceDto> {
    const query = toGoogleQuery({
      ...period,
      searchType: 'web',
      aggregation: 'byProperty',
      rowLimit: 2,
    });
    const property = this.client.property;
    if (period.startDate >= brandDataSince) {
      try {
        const rows = readRows(
          await this.client.query({ ...query, dimensions: ['brandedClassification'] }),
          1,
        );
        const branded = metrics(rows.find(({ keys }) => keys[0] === 'BRANDED'));
        const nonBranded = metrics(rows.find(({ keys }) => keys[0] === 'NON_BRANDED'));
        if (branded || nonBranded)
          return { property, classification: 'google', branded, nonBranded };
      } catch (error) {
        if (!(error instanceof SearchConsoleError) || error.code !== 'invalid_query') throw error;
      }
    }
    const estimate = async (operator: 'includingRegex' | 'excludingRegex') => {
      const response = await this.client.query({
        ...query,
        rowLimit: 1,
        dimensionFilterGroups: [
          {
            groupType: 'and',
            filters: [{ dimension: 'query', operator, expression: brandPattern }],
          },
        ],
      });
      return metrics(readRows(response, 0)[0]);
    };
    const [branded, nonBranded] = await Promise.all([
      estimate('includingRegex'),
      estimate('excludingRegex'),
    ]);
    return { property, classification: 'estimated', branded, nonBranded };
  }

  async sitemaps(): Promise<SearchConsoleSitemapsDto> {
    const response = await this.client.listSitemaps();
    const items = records(response, 'sitemap').map((entry) => {
      const sitemap = searchConsoleRecord(entry);
      if (!sitemap) throw new SearchConsoleError('invalid_response');
      return {
        path: sitemapUrl(sitemap.path),
        lastSubmitted: optionalTimestamp(sitemap.lastSubmitted),
        lastDownloaded: optionalTimestamp(sitemap.lastDownloaded),
        isPending: typeof sitemap.isPending === 'boolean' ? sitemap.isPending : null,
        isSitemapIndex:
          typeof sitemap.isSitemapsIndex === 'boolean' ? sitemap.isSitemapsIndex : null,
        warnings: optionalCount(sitemap.warnings),
        errors: optionalCount(sitemap.errors),
        contents: records(sitemap, 'contents').flatMap((item) => {
          const content = searchConsoleRecord(item);
          return typeof content?.type === 'string'
            ? [{ type: content.type, submitted: optionalCount(content.submitted) }]
            : [];
        }),
      };
    });
    return { property: this.client.property, items };
  }
}
