import { createHash } from 'node:crypto';
import type {
  SearchConsoleMetricsDto,
  SearchConsolePerformanceDto,
  SearchConsoleRowDto,
} from '../dto/search-console.dto';
import { SearchConsoleError } from './search-console-errors';
import type { SearchConsoleService } from './search-console.service';

const dayMs = 86_400_000;
const pacificDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Los_Angeles',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const rowLimit = 500;
const pageLimit = 2;
const series = {
  PROPERTY: [],
  DEVICE: ['device'],
  QUERY: ['query'],
  PAGE: ['page'],
  PAGE_QUERY: ['page', 'query'],
  PAGE_DEVICE: ['page', 'device'],
} as const;
type Series = keyof typeof series;
type Aggregation = SearchConsolePerformanceDto['aggregation'];
export type SyncSearchType = 'web' | 'image' | 'video' | 'news';

export type DailyMetric = {
  dimensionKey: string;
  scope: Series | 'BRAND';
  aggregation: Aggregation;
  device: string | null;
  searchQuery: string | null;
  reportedUrl: string | null;
  brand: string | null;
  brandSource: 'google' | 'estimated' | null;
  clicks: number;
  impressions: number;
  averagePosition: number | null;
};

type SeriesCoverage = {
  rows: number;
  aggregation: Aggregation;
  capped: boolean;
  classification?: 'google' | 'estimated';
};

export function dayLabel(day: Date): string {
  return day.toISOString().slice(0, 10);
}

export function shiftDay(day: Date, offset: number): Date {
  return new Date(day.getTime() + offset * dayMs);
}

export function searchConsoleDay(now: Date): Date {
  const parts = pacificDate.formatToParts(now);
  const get = (type: 'year' | 'month' | 'day') => parts.find((part) => part.type === type)?.value;
  return new Date(`${get('year')}-${get('month')}-${get('day')}T00:00:00.000Z`);
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function aggregateDailyMetrics(
  rows: readonly Pick<DailyMetric, 'clicks' | 'impressions' | 'averagePosition'>[],
): (Omit<SearchConsoleMetricsDto, 'ctr'> & { ctr: number | null }) | null {
  if (!rows.length) return null;
  let clicks = 0;
  let impressions = 0;
  let positionedImpressions = 0;
  let weightedPosition = 0;
  for (const row of rows) {
    clicks += row.clicks;
    impressions += row.impressions;
    if (row.averagePosition !== null) {
      positionedImpressions += row.impressions;
      weightedPosition += row.averagePosition * row.impressions;
    }
  }
  return {
    clicks,
    impressions,
    ctr: impressions > 0 ? clicks / impressions : null,
    averagePosition:
      impressions > 0 && positionedImpressions === impressions
        ? weightedPosition / impressions
        : null,
  };
}

export async function fetchDailyMetrics(
  service: SearchConsoleService,
  property: string,
  date: Date,
  searchType: SyncSearchType,
) {
  const daily = new Map<string, DailyMetric>();
  const coverage: Record<string, SeriesCoverage> = {};
  const day = dayLabel(date);
  const period = { startDate: day, endDate: day };
  for (const scope of Object.keys(series) as Series[]) {
    const dimensions = [...series[scope]];
    const byPage = scope.startsWith('PAGE');
    let startRow = 0;
    let aggregation: Aggregation = null;
    let capped = false;
    const rows = new Map<string, SearchConsoleRowDto>();
    for (let page = 0; page < pageLimit; page++) {
      const result = await service.performance({
        ...period,
        dimensions,
        searchType,
        aggregation: byPage ? 'auto' : 'byProperty',
        rowLimit: scope === 'PROPERTY' ? 1 : rowLimit,
        startRow,
      });
      if (
        result.property !== property ||
        (result.aggregation && result.aggregation !== (byPage ? 'byPage' : 'byProperty')) ||
        result.rows.length > (scope === 'PROPERTY' ? 1 : rowLimit)
      ) {
        throw new SearchConsoleError('invalid_response');
      }
      aggregation ??= result.aggregation;
      for (const row of result.rows) {
        if (row.keys.some((value) => !value || value.includes('\0'))) {
          throw new SearchConsoleError('invalid_response');
        }
        rows.set(JSON.stringify(row.keys), row);
      }
      capped = result.nextStartRow !== null;
      if (result.nextStartRow === null) break;
      startRow = result.nextStartRow;
    }
    coverage[scope] = { rows: rows.size, aggregation, capped };
    for (const [key, row] of rows) {
      const dimensionsByName = new Map(dimensions.map((name, index) => [name, row.keys[index]]));
      const device = dimensionsByName.get('device') ?? null;
      if (device && !['DESKTOP', 'MOBILE', 'TABLET'].includes(device.toUpperCase())) {
        throw new SearchConsoleError('invalid_response');
      }
      const dimensionKey = sha256(JSON.stringify([searchType, scope, key]));
      daily.set(dimensionKey, {
        dimensionKey,
        scope,
        aggregation,
        device,
        searchQuery: dimensionsByName.get('query') ?? null,
        reportedUrl: dimensionsByName.get('page') ?? null,
        brand: null,
        brandSource: null,
        clicks: row.clicks,
        impressions: row.impressions,
        averagePosition: row.averagePosition,
      });
    }
  }

  if (searchType === 'web') {
    const result = await service.brandPerformance(period);
    if (result.property !== property) throw new SearchConsoleError('invalid_response');
    const brands = [
      ['BRANDED', result.branded],
      ['NON_BRANDED', result.nonBranded],
    ] as const;
    for (const [brand, row] of brands) {
      if (!row) continue;
      const dimensionKey = sha256(JSON.stringify([searchType, 'BRAND', brand]));
      daily.set(dimensionKey, {
        dimensionKey,
        scope: 'BRAND',
        aggregation: 'byProperty',
        device: null,
        searchQuery: null,
        reportedUrl: null,
        brand,
        brandSource: result.classification,
        clicks: row.clicks,
        impressions: row.impressions,
        averagePosition: row.averagePosition,
      });
    }
    coverage.BRAND = {
      rows: brands.filter(([, row]) => row !== null).length,
      aggregation: 'byProperty',
      classification: result.classification,
      capped: false,
    };
  }
  return { rows: [...daily.values()], coverage };
}
