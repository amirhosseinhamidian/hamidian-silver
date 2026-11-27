import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type {
  SearchEntityDetailDto,
  SearchEntityDetailQueryDto,
  SearchEntityIdentityDto,
  SearchEntityListDto,
  SearchEntityListQueryDto,
  SearchEntityUrlDto,
  SeoEntityKind,
} from '../dto/search-entity.dto';
import { SEO_CANONICAL_PATH_PATTERN } from '../seo-validation';
import { SEARCH_CONSOLE_CLIENT, type SearchConsoleClient } from './google-search-console.client';
import { dayLabel, sha256 } from './search-console-sync-data';
import {
  entityBreakdownQuery,
  entityDaysQuery,
  entityScoresQuery,
  entitySourceQuery,
  seoEntitySources,
  type EntityBreakdown,
  type EntityScores,
  type EntitySourceRow,
} from './search-entity-query';
import type { OverviewDayRow } from './search-overview-query';
import { compareSearchPeriods, reportCalendar } from './search-overview.service';

type InventoryRow = {
  id: string;
  reportedUrl: string;
  reportedSearch: string | null;
  canonicalPath: string | null;
  matchedBy: string | null;
};
const urlSelect = {
  id: true,
  reportedUrl: true,
  reportedSearch: true,
  canonicalPath: true,
  matchedBy: true,
} as const;
const pageSize = 25;

function urlDto(row: InventoryRow, canonicalUrl: string): SearchEntityUrlDto {
  return {
    id: row.id,
    reportedUrl: row.reportedUrl,
    reportedSearch: row.reportedSearch,
    recordedCanonicalPath: row.canonicalPath,
    matchedBy: row.matchedBy === 'direct' || row.matchedBy === 'redirect' ? row.matchedBy : null,
    isCanonical: row.reportedUrl === canonicalUrl,
  };
}

@Injectable()
export class SearchEntityService {
  private readonly origin: string;
  private concurrentLists = 0;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
    @Inject(SEARCH_CONSOLE_CLIENT) private readonly client: SearchConsoleClient,
  ) {
    this.origin = new URL(
      config.get<string>('STOREFRONT_PUBLIC_ORIGIN') || 'https://hamidian.shop',
    ).origin;
  }

  private identity(kind: SeoEntityKind, row: EntitySourceRow): SearchEntityIdentityDto {
    const prefix = seoEntitySources[kind].path;
    const override = row.seoCanonicalPath?.trim();
    const canonicalPath =
      override?.startsWith(prefix) && SEO_CANONICAL_PATH_PATTERN.test(override)
        ? override
        : `${prefix}${row.slug}`;
    return {
      id: row.id,
      kind,
      name: row.name,
      seoNoIndex: row.seoNoIndex,
      canonicalUrl: new URL(canonicalPath, this.origin).href,
    };
  }

  async list(query: SearchEntityListQueryDto): Promise<SearchEntityListDto> {
    const dates = reportCalendar(query);
    if (query.q?.includes('\0')) throw new BadRequestException('Invalid search text.');
    if (this.concurrentLists >= 4)
      throw new HttpException('Search entity reports are busy.', HttpStatus.TOO_MANY_REQUESTS);
    const page = query.page ?? 1;
    this.concurrentLists++;
    try {
      return await this.prisma.$transaction(
        async (db) => {
          const matches = await db.$queryRaw<EntitySourceRow[]>(
            entitySourceQuery(query.kind, { text: query.q?.trim() }),
          );
          if (matches.length === 0) return { page, limit: pageSize, total: 0, items: [] };
          const entities = new Map(matches.map((row) => [row.id, this.identity(query.kind, row)]));
          const integration = await db.seoIntegration.findUnique({
            where: { property: this.client.property },
            select: { id: true },
          });
          const [summary] = await db.$queryRaw<{ total: number; items: EntityScores[] }[]>(
            entityScoresQuery(
              {
                integrationId: integration?.id ?? null,
                searchType: dates.searchType,
                startDate: dayLabel(dates.previousFirst),
                endDate: query.endDate,
              },
              query.startDate,
              dates.days,
              [...entities.values()].map(({ id, name, canonicalUrl, seoNoIndex }) => ({
                id,
                name,
                urlKey: sha256(canonicalUrl),
                seoNoIndex,
              })),
              query,
              page,
              pageSize,
            ),
          );
          return {
            page,
            limit: pageSize,
            total: summary.total,
            items: summary.items.map(({ id, ...scores }) => ({ ...entities.get(id)!, ...scores })),
          };
        },
        { isolationLevel: 'RepeatableRead', timeout: 10_000 },
      );
    } finally {
      this.concurrentLists--;
    }
  }

  async detail(
    kind: SeoEntityKind,
    id: string,
    query: SearchEntityDetailQueryDto,
  ): Promise<SearchEntityDetailDto> {
    const dates = reportCalendar(query);
    const urlPage = query.urlPage ?? 1;
    return this.prisma.$transaction(
      async (db) => {
        const [row] = await db.$queryRaw<EntitySourceRow[]>(entitySourceQuery(kind, { id }));
        if (!row) throw new NotFoundException('Public SEO entity not found.');
        const entity = this.identity(kind, row);
        const integration = await db.seoIntegration.findUnique({
          where: { property: this.client.property },
          select: { id: true },
        });
        const window = {
          integrationId: integration?.id ?? null,
          searchType: dates.searchType,
          startDate: dayLabel(dates.previousFirst),
          endDate: query.endDate,
        };
        let related: InventoryRow[] = [];
        let current: InventoryRow | null = null;
        let urlTotal = 0;
        if (integration) {
          const where = { integrationId: integration.id, [seoEntitySources[kind].foreignKey]: id };
          [related, current, urlTotal] = await Promise.all([
            db.seoUrlInventory.findMany({
              where,
              orderBy: [{ lastObservedAt: 'desc' }, { id: 'asc' }],
              skip: (urlPage - 1) * pageSize,
              take: pageSize,
              select: urlSelect,
            }),
            db.seoUrlInventory.findFirst({
              where: {
                ...where,
                ...(query.urlId ? { id: query.urlId } : { urlKey: sha256(entity.canonicalUrl) }),
              },
              select: urlSelect,
            }),
            db.seoUrlInventory.count({ where }),
          ]);
        }
        if (query.urlId && !current)
          throw new NotFoundException('URL is not associated with this entity.');
        const [daily, [breakdown]] = await Promise.all([
          db.$queryRaw<OverviewDayRow[]>(entityDaysQuery(window, current?.id ?? null)),
          current
            ? db.$queryRaw<EntityBreakdown[]>(
                entityBreakdownQuery({ ...window, startDate: query.startDate }, current.id),
              )
            : Promise.resolve([{ topQueries: [], devices: [], cappedQueryDays: 0 }]),
        ]);
        const comparison = compareSearchPeriods(dates, daily);
        return {
          entity,
          selectedUrl: current ? urlDto(current, entity.canonicalUrl) : null,
          urls: related.map((entry) => urlDto(entry, entity.canonicalUrl)),
          urlPage,
          urlLimit: pageSize,
          urlTotal,
          ...comparison,
          ...breakdown,
          sufficient:
            comparison.current.days === comparison.current.dataDays &&
            (comparison.current.metrics?.impressions ?? 0) >= (query.minimumImpressions ?? 100),
        };
      },
      { isolationLevel: 'RepeatableRead', timeout: 10_000 },
    );
  }
}
