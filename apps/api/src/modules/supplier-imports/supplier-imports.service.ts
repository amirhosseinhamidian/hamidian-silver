import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { Prisma } from '../../generated/prisma/client';
import {
  SupplierCrawlRunStatus,
  SupplierCrawlScope,
  SupplierProductImportStatus,
  SupplierProductSourceChangeType,
  SupplierSourceAvailability,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { BsjSilverCrawlerAdapter } from './adapters/bsj-silver-crawler.adapter';
import { SaatYekCrawlerAdapter } from './adapters/saatyek-crawler.adapter';
import { ListSupplierImportDraftsQueryDto } from './dto/list-supplier-import-drafts-query.dto';
import { ListSupplierCrawlRunsQueryDto } from './dto/list-supplier-crawl-runs-query.dto';
import { ListSupplierSourceChangesQueryDto } from './dto/list-supplier-source-changes-query.dto';
import { ListSupplierCategoriesQueryDto } from './dto/list-supplier-categories-query.dto';
import { StartBulkSupplierCrawlDto } from './dto/start-bulk-supplier-crawl.dto';
import { StartSupplierCrawlDto } from './dto/start-supplier-crawl.dto';
import { SyncSupplierCategoriesDto } from './dto/sync-supplier-categories.dto';
import { UpdateSupplierCrawlScheduleDto } from './dto/update-supplier-crawl-schedule.dto';
import { UpdateSupplierCategoryMappingDto } from './dto/update-supplier-category-mapping.dto';
import { UpdateSupplierImportDraftDto } from './dto/update-supplier-import-draft.dto';
import type { SupplierCrawlerAdapter } from './supplier-crawler.types';

const HTML_RESPONSE_LIMIT_BYTES = 5 * 1024 * 1024;
const IMAGE_RESPONSE_LIMIT_BYTES = 10 * 1024 * 1024;
const CRAWL_TIMEOUT_MS = 20_000;
const CRAWL_REQUEST_ATTEMPTS = 4;
const CRAWL_RETRY_BASE_DELAY_MS = 2_000;
const MAX_REDIRECTS = 3;
const BULK_CRAWL_SCOPES = [
  SupplierCrawlScope.CATALOG,
  SupplierCrawlScope.CATEGORY_URL,
  SupplierCrawlScope.SCHEDULED,
] as const;
const SCHEDULE_TIMEZONE = 'Asia/Tehran';

type ActiveSupplierSource = Readonly<{
  id: string;
  hostname: string;
  adapterKey: string | null;
  baseUrl?: string;
  crawlDelayMs?: number;
}>;

type CrawlScheduleConfig = Readonly<{
  id: string;
  supplierSourceId: string;
  categoryIds: string[];
  requestedLimit: number;
  stopAtKnown: boolean;
  maxRetries: number;
  retryDelayMinutes: number;
  monitorKnownProducts: boolean;
}>;

@Injectable()
export class SupplierImportsService {
  private readonly logger = new Logger(SupplierImportsService.name);
  private readonly adapters: ReadonlyMap<string, SupplierCrawlerAdapter>;

  constructor(
    private readonly prisma: PrismaService,
    bsjSilverAdapter: BsjSilverCrawlerAdapter,
    saatYekAdapter: SaatYekCrawlerAdapter,
  ) {
    this.adapters = new Map<string, SupplierCrawlerAdapter>([
      [bsjSilverAdapter.key, bsjSilverAdapter],
      [saatYekAdapter.key, saatYekAdapter],
    ]);
  }

  listSources() {
    return this.prisma.supplierSource.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        supplier: { isActive: true, deletedAt: null },
      },
      orderBy: [{ supplier: { name: 'asc' } }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        baseUrl: true,
        hostname: true,
        crawlerType: true,
        adapterKey: true,
        crawlDelayMs: true,
        maxConcurrency: true,
        supplier: { select: { id: true, name: true, code: true } },
        crawlRuns: {
          take: 1,
          orderBy: { createdAt: 'desc' as const },
          select: {
            id: true,
            status: true,
            targetUrl: true,
            discoveredCount: true,
            succeededCount: true,
            failedCount: true,
            errorMessage: true,
            startedAt: true,
            finishedAt: true,
            createdAt: true,
          },
        },
      },
    });
  }

  async listDrafts(query: ListSupplierImportDraftsQueryDto) {
    const where: Prisma.SupplierProductImportDraftWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.supplierSourceId ? { supplierSourceId: query.supplierSourceId } : {}),
    };
    const [total, items] = await this.prisma.$transaction([
      this.prisma.supplierProductImportDraft.count({ where }),
      this.prisma.supplierProductImportDraft.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        include: {
          supplierSource: {
            select: {
              id: true,
              name: true,
              hostname: true,
              supplier: { select: { id: true, name: true, code: true } },
            },
          },
          crawlRun: {
            select: { id: true, status: true, createdAt: true, finishedAt: true },
          },
          reviewedBy: {
            select: { id: true, firstName: true, lastName: true, phone: true },
          },
          product: { select: { id: true, name: true, slug: true, status: true } },
          importedBy: {
            select: { id: true, firstName: true, lastName: true, phone: true },
          },
          sourceCategoryRecord: { select: { id: true, catalogCategoryId: true } },
        },
      }),
    ]);
    return {
      items,
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }

  async getDraft(draftId: string) {
    const draft = await this.prisma.supplierProductImportDraft.findUnique({
      where: { id: draftId },
      include: {
        supplierSource: {
          select: {
            id: true,
            name: true,
            hostname: true,
            supplier: { select: { id: true, name: true, code: true } },
          },
        },
        crawlRun: { select: { id: true, status: true, createdAt: true, finishedAt: true } },
        reviewedBy: { select: { id: true, firstName: true, lastName: true, phone: true } },
        product: { select: { id: true, name: true, slug: true, status: true } },
        importedBy: { select: { id: true, firstName: true, lastName: true, phone: true } },
        sourceCategoryRecord: { select: { id: true, catalogCategoryId: true } },
      },
    });
    if (!draft) throw new NotFoundException('Supplier product import draft was not found.');
    return draft;
  }

  listCategories(query: ListSupplierCategoriesQueryDto) {
    return this.prisma.supplierSourceCategory.findMany({
      where: { supplierSourceId: query.supplierSourceId, isActive: true },
      orderBy: [{ name: 'asc' }, { externalKey: 'asc' }],
      include: { catalogCategory: { select: { id: true, name: true } } },
    });
  }

  async updateCategoryMapping(categoryId: string, dto: UpdateSupplierCategoryMappingDto) {
    const category = await this.prisma.supplierSourceCategory.findUnique({
      where: { id: categoryId },
      select: { id: true },
    });
    if (!category) throw new NotFoundException('Supplier category was not found.');
    const catalogCategoryId = dto.catalogCategoryId ?? null;
    if (catalogCategoryId) {
      const catalogCategory = await this.prisma.category.findFirst({
        where: { id: catalogCategoryId, isActive: true, deletedAt: null },
        select: { id: true },
      });
      if (!catalogCategory) throw new NotFoundException('Active catalog category was not found.');
    }
    return this.prisma.supplierSourceCategory.update({
      where: { id: categoryId },
      data: { catalogCategoryId },
      include: { catalogCategory: { select: { id: true, name: true } } },
    });
  }

  async listSourceChanges(query: ListSupplierSourceChangesQueryDto) {
    const where: Prisma.SupplierProductSourceChangeWhereInput = { acknowledgedAt: null };
    const [total, items] = await this.prisma.$transaction([
      this.prisma.supplierProductSourceChange.count({ where }),
      this.prisma.supplierProductSourceChange.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: {
          draft: {
            select: {
              id: true,
              title: true,
              sourceUrl: true,
              product: { select: { id: true, name: true } },
              supplierSource: { select: { name: true, supplier: { select: { name: true } } } },
            },
          },
        },
      }),
    ]);
    return {
      items,
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }

  async acknowledgeSourceChange(changeId: string, actorUserId: string) {
    const result = await this.prisma.supplierProductSourceChange.updateMany({
      where: { id: changeId, acknowledgedAt: null },
      data: { acknowledgedAt: new Date(), acknowledgedByUserId: actorUserId },
    });
    if (!result.count) {
      throw new ConflictException('Source change was already acknowledged or not found.');
    }
    return { id: changeId, acknowledged: true };
  }

  listSchedules() {
    return this.prisma.supplierCrawlSchedule.findMany({
      where: {
        supplierSource: {
          isActive: true,
          deletedAt: null,
          supplier: { isActive: true, deletedAt: null },
        },
      },
      orderBy: { supplierSource: { supplier: { name: 'asc' } } },
      include: {
        supplierSource: {
          select: {
            id: true,
            name: true,
            supplier: { select: { id: true, name: true, code: true } },
          },
        },
        crawlRuns: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: { id: true, status: true, createdAt: true, finishedAt: true },
        },
      },
    });
  }

  async updateSchedule(supplierSourceId: string, dto: UpdateSupplierCrawlScheduleDto) {
    await this.activeSource(supplierSourceId);
    await this.validateScheduleCategories(supplierSourceId, dto.categoryIds);
    const now = new Date();
    return this.prisma.supplierCrawlSchedule.upsert({
      where: { supplierSourceId },
      create: {
        supplierSourceId,
        categoryIds: dto.categoryIds,
        isEnabled: dto.isEnabled,
        timeOfDay: dto.timeOfDay,
        timezone: SCHEDULE_TIMEZONE,
        requestedLimit: dto.requestedLimit,
        stopAtKnown: dto.stopAtKnown,
        monitorKnownProducts: dto.monitorKnownProducts,
        maxRetries: dto.maxRetries,
        retryDelayMinutes: dto.retryDelayMinutes,
        nextRunAt: dto.isEnabled
          ? this.nextDailyOccurrence(now, dto.timeOfDay, SCHEDULE_TIMEZONE)
          : null,
      },
      update: {
        categoryIds: dto.categoryIds,
        isEnabled: dto.isEnabled,
        timeOfDay: dto.timeOfDay,
        timezone: SCHEDULE_TIMEZONE,
        requestedLimit: dto.requestedLimit,
        stopAtKnown: dto.stopAtKnown,
        monitorKnownProducts: dto.monitorKnownProducts,
        maxRetries: dto.maxRetries,
        retryDelayMinutes: dto.retryDelayMinutes,
        nextRunAt: dto.isEnabled
          ? this.nextDailyOccurrence(now, dto.timeOfDay, SCHEDULE_TIMEZONE)
          : null,
      },
    });
  }

  async runScheduleNow(supplierSourceId: string) {
    const schedule = await this.prisma.supplierCrawlSchedule.findUnique({
      where: { supplierSourceId },
      include: { supplierSource: true },
    });
    if (!schedule) throw new NotFoundException('Supplier crawl schedule was not found.');
    return this.enqueueSchedule(schedule);
  }

  async listRuns(query: ListSupplierCrawlRunsQueryDto) {
    const where: Prisma.SupplierCrawlRunWhereInput = {
      scope: { in: [...BULK_CRAWL_SCOPES] },
      archivedAt: query.view === 'ARCHIVED' ? { not: null } : null,
    };
    const [total, items] = await this.prisma.$transaction([
      this.prisma.supplierCrawlRun.count({ where }),
      this.prisma.supplierCrawlRun.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: {
          supplierSource: {
            select: { id: true, name: true, supplier: { select: { name: true } } },
          },
          category: { select: { id: true, name: true } },
          schedule: { select: { categoryIds: true } },
          issues: {
            take: 5,
            orderBy: { createdAt: 'desc' },
            select: { id: true, sourceUrl: true, errorMessage: true, createdAt: true },
          },
          archivedBy: { select: { id: true, firstName: true, lastName: true, phone: true } },
        },
      }),
    ]);
    return {
      items,
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }

  async archiveRun(runId: string, userId: string) {
    const result = await this.prisma.supplierCrawlRun.updateMany({
      where: {
        id: runId,
        scope: { in: [...BULK_CRAWL_SCOPES] },
        archivedAt: null,
        status: {
          in: [
            SupplierCrawlRunStatus.SUCCEEDED,
            SupplierCrawlRunStatus.PARTIAL,
            SupplierCrawlRunStatus.FAILED,
            SupplierCrawlRunStatus.CANCELLED,
          ],
        },
      },
      data: { archivedAt: new Date(), archivedByUserId: userId },
    });
    if (!result.count) {
      throw new ConflictException('Only a finished, unarchived crawl can be archived.');
    }
    return { id: runId, archived: true };
  }

  async syncCategories(dto: SyncSupplierCategoriesDto) {
    const source = await this.activeSource(dto.supplierSourceId);
    const adapter = this.adapterFor(source);
    const listingUrl = new URL(adapter.listingUrl(source.baseUrl!, 1));
    const categories = adapter.parseCategories(
      await this.fetchText(listingUrl, source),
      listingUrl.toString(),
    );
    const now = new Date();
    await this.prisma.$transaction(async (transaction) => {
      await transaction.supplierSourceCategory.updateMany({
        where: { supplierSourceId: source.id },
        data: { isActive: false },
      });
      for (const category of categories) {
        await transaction.supplierSourceCategory.upsert({
          where: {
            supplierSourceId_externalKey: {
              supplierSourceId: source.id,
              externalKey: category.externalKey,
            },
          },
          create: { supplierSourceId: source.id, ...category, lastSeenAt: now },
          update: { name: category.name, url: category.url, isActive: true, lastSeenAt: now },
        });
      }
    });
    return { count: categories.length };
  }

  async startBulkCrawl(dto: StartBulkSupplierCrawlDto) {
    const source = await this.activeSource(dto.supplierSourceId);
    const adapter = this.adapterFor(source);
    const active = await this.prisma.supplierCrawlRun.findFirst({
      where: {
        supplierSourceId: source.id,
        status: {
          in: [
            SupplierCrawlRunStatus.QUEUED,
            SupplierCrawlRunStatus.RUNNING,
            SupplierCrawlRunStatus.PAUSED,
          ],
        },
      },
      select: { id: true },
    });
    if (active) throw new ConflictException('An unfinished crawl already exists for this source.');
    const category = dto.categoryId
      ? await this.prisma.supplierSourceCategory.findFirst({
          where: { id: dto.categoryId, supplierSourceId: source.id, isActive: true },
        })
      : null;
    if (dto.categoryId && !category) {
      throw new NotFoundException('Active supplier category was not found.');
    }
    const previousArchiveProgress = dto.resumeArchive
      ? await this.prisma.supplierCrawlRun.aggregate({
          where: {
            supplierSourceId: source.id,
            categoryId: category?.id ?? null,
            scope: category ? SupplierCrawlScope.CATEGORY_URL : SupplierCrawlScope.CATALOG,
            stopAtKnown: false,
            succeededCount: { gt: 0 },
            status: {
              in: [
                SupplierCrawlRunStatus.SUCCEEDED,
                SupplierCrawlRunStatus.PARTIAL,
                SupplierCrawlRunStatus.FAILED,
                SupplierCrawlRunStatus.CANCELLED,
              ],
            },
          },
          _max: { currentPage: true },
        })
      : null;
    const currentPage = Math.max(1, previousArchiveProgress?._max.currentPage ?? 1);
    const targetUrl = adapter.listingUrl(category?.url ?? source.baseUrl!, 1);
    return this.prisma.supplierCrawlRun.create({
      data: {
        supplierSourceId: source.id,
        categoryId: category?.id,
        scope: category ? SupplierCrawlScope.CATEGORY_URL : SupplierCrawlScope.CATALOG,
        targetUrl,
        currentPage,
        requestedLimit: dto.limit,
        stopAtKnown: dto.stopAtKnown,
        monitorKnownProducts: dto.monitorKnownProducts,
        maxRetries: 5,
        retryDelayMinutes: 5,
        status: SupplierCrawlRunStatus.QUEUED,
      },
    });
  }

  async pauseRun(runId: string) {
    const result = await this.prisma.supplierCrawlRun.updateMany({
      where: {
        id: runId,
        status: { in: [SupplierCrawlRunStatus.QUEUED, SupplierCrawlRunStatus.RUNNING] },
      },
      data: { status: SupplierCrawlRunStatus.PAUSED },
    });
    if (!result.count) throw new ConflictException('Only an active crawl can be paused.');
    return { id: runId, status: SupplierCrawlRunStatus.PAUSED };
  }

  async resumeRun(runId: string) {
    const result = await this.prisma.supplierCrawlRun.updateMany({
      where: { id: runId, status: SupplierCrawlRunStatus.PAUSED },
      data: { status: SupplierCrawlRunStatus.QUEUED, errorMessage: null },
    });
    if (!result.count) throw new ConflictException('Only a paused crawl can be resumed.');
    return { id: runId, status: SupplierCrawlRunStatus.QUEUED };
  }

  async retryRun(runId: string) {
    const result = await this.prisma.supplierCrawlRun.updateMany({
      where: { id: runId, status: SupplierCrawlRunStatus.FAILED },
      data: {
        status: SupplierCrawlRunStatus.QUEUED,
        retryCount: 0,
        availableAt: new Date(),
        errorMessage: null,
        finishedAt: null,
        lastHeartbeatAt: null,
      },
    });
    if (!result.count) throw new ConflictException('Only a failed crawl can be retried.');
    return { id: runId, status: SupplierCrawlRunStatus.QUEUED };
  }

  @Interval('supplier-bulk-crawl-queue', 10_000)
  async processBulkQueue() {
    try {
      const staleBefore = new Date(Date.now() - 5 * 60_000);
      await this.prisma.supplierCrawlRun.updateMany({
        where: {
          status: SupplierCrawlRunStatus.RUNNING,
          scope: { in: [...BULK_CRAWL_SCOPES] },
          OR: [{ lastHeartbeatAt: null }, { lastHeartbeatAt: { lt: staleBefore } }],
        },
        data: { status: SupplierCrawlRunStatus.QUEUED },
      });
      const queued = await this.prisma.supplierCrawlRun.findFirst({
        where: {
          status: SupplierCrawlRunStatus.QUEUED,
          scope: { in: [...BULK_CRAWL_SCOPES] },
          availableAt: { lte: new Date() },
        },
        orderBy: { createdAt: 'asc' },
        select: { id: true, startedAt: true },
      });
      if (!queued) return;
      const claimed = await this.prisma.supplierCrawlRun.updateMany({
        where: { id: queued.id, status: SupplierCrawlRunStatus.QUEUED },
        data: {
          status: SupplierCrawlRunStatus.RUNNING,
          ...(queued.startedAt ? {} : { startedAt: new Date() }),
          lastHeartbeatAt: new Date(),
        },
      });
      if (!claimed.count) return;
      await this.processNextBulkPage(queued.id);
    } catch (error) {
      this.logger.error(`Supplier bulk crawl worker failed: ${this.errorMessage(error)}`);
    }
  }

  @Interval('supplier-crawl-scheduler', 60_000)
  async processSchedules() {
    const now = new Date();
    try {
      const due = await this.prisma.supplierCrawlSchedule.findMany({
        where: { isEnabled: true, nextRunAt: { lte: now } },
        orderBy: { nextRunAt: 'asc' },
        take: 20,
        include: { supplierSource: true },
      });
      for (const schedule of due) {
        const nextRunAt = this.nextDailyOccurrence(now, schedule.timeOfDay, schedule.timezone);
        const leaseUntil = new Date(now.getTime() + 15 * 60_000);
        const claimed = await this.prisma.supplierCrawlSchedule.updateMany({
          where: { id: schedule.id, isEnabled: true, nextRunAt: { lte: now } },
          data: { nextRunAt: leaseUntil },
        });
        if (!claimed.count) continue;
        try {
          await this.enqueueSchedule(schedule, nextRunAt);
        } catch (error) {
          if (error instanceof ConflictException) {
            await this.prisma.supplierCrawlSchedule.update({
              where: { id: schedule.id },
              data: { nextRunAt: leaseUntil },
            });
          } else {
            this.logger.error(
              `Supplier crawl schedule ${schedule.id} failed: ${this.errorMessage(error)}`,
            );
          }
        }
      }
    } catch (error) {
      this.logger.error(`Supplier crawl scheduler failed: ${this.errorMessage(error)}`);
    }
  }

  async crawlProduct(dto: StartSupplierCrawlDto) {
    const source = await this.prisma.supplierSource.findFirst({
      where: {
        id: dto.supplierSourceId,
        isActive: true,
        deletedAt: null,
        supplier: { isActive: true, deletedAt: null },
      },
      select: { id: true, hostname: true, adapterKey: true },
    });
    if (!source) throw new NotFoundException('Active supplier source was not found.');

    const adapter = source.adapterKey ? this.adapters.get(source.adapterKey) : undefined;
    if (!adapter) {
      throw new BadRequestException('This supplier source does not have a supported crawler.');
    }
    const targetUrl = this.validateSourceUrl(dto.targetUrl, source);
    if (!adapter.supportsProductUrl(targetUrl)) {
      throw new BadRequestException('The target URL must be a supplier product page.');
    }

    const running = await this.prisma.supplierCrawlRun.findFirst({
      where: {
        supplierSourceId: source.id,
        status: {
          in: [
            SupplierCrawlRunStatus.QUEUED,
            SupplierCrawlRunStatus.RUNNING,
            SupplierCrawlRunStatus.PAUSED,
          ],
        },
      },
      select: { id: true },
    });
    if (running)
      throw new ConflictException('A crawl is already running for this supplier source.');

    const run = await this.prisma.supplierCrawlRun.create({
      data: {
        supplierSourceId: source.id,
        scope: SupplierCrawlScope.PRODUCT_URL,
        targetUrl: targetUrl.toString(),
        status: SupplierCrawlRunStatus.RUNNING,
        startedAt: new Date(),
      },
      select: { id: true },
    });

    try {
      const html = await this.fetchText(targetUrl, source);
      const product = adapter.parseProduct(html, targetUrl.toString());
      const now = new Date();
      const draft = await this.prisma.$transaction(async (transaction) => {
        const existing = await transaction.supplierProductImportDraft.findUnique({
          where: {
            supplierSourceId_sourceProductKey: {
              supplierSourceId: source.id,
              sourceProductKey: product.sourceProductKey,
            },
          },
          select: {
            id: true,
            productId: true,
            status: true,
            supplierRetailPriceToman: true,
            sourceAvailability: true,
          },
        });
        const sourceCategoryRecord = product.sourceCategory
          ? await transaction.supplierSourceCategory.findFirst({
              where: {
                supplierSourceId: source.id,
                isActive: true,
                name: product.sourceCategory,
              },
              select: { id: true },
            })
          : null;
        const alreadyImported =
          Boolean(existing?.productId) || existing?.status === SupplierProductImportStatus.IMPORTED;
        const saved = await transaction.supplierProductImportDraft.upsert({
          where: {
            supplierSourceId_sourceProductKey: {
              supplierSourceId: source.id,
              sourceProductKey: product.sourceProductKey,
            },
          },
          create: {
            supplierSourceId: source.id,
            crawlRunId: run.id,
            sourceProductKey: product.sourceProductKey,
            sourceUrl: product.sourceUrl,
            sourceSku: product.sourceSku,
            title: product.title,
            description: product.description,
            sourceCategory: product.sourceCategory,
            sourceCategoryId: sourceCategoryRecord?.id,
            supplierRetailPriceToman: product.supplierRetailPriceToman,
            sourceAvailability: product.availability,
            weightGrams: product.weightGrams,
            attributes: this.jsonValue(product.attributes),
            imageUrls: [...product.imageUrls],
            rawPayload: this.jsonValue(product.rawPayload),
            status: SupplierProductImportStatus.PENDING_REVIEW,
            lastCrawledAt: now,
          },
          update: {
            crawlRunId: run.id,
            sourceUrl: product.sourceUrl,
            sourceSku: product.sourceSku,
            title: product.title,
            description: product.description,
            sourceCategory: product.sourceCategory,
            sourceCategoryId: sourceCategoryRecord?.id,
            supplierRetailPriceToman: product.supplierRetailPriceToman,
            ...(product.availability === SupplierSourceAvailability.UNKNOWN
              ? {}
              : { sourceAvailability: product.availability }),
            weightGrams: product.weightGrams,
            attributes: this.jsonValue(product.attributes),
            imageUrls: [...product.imageUrls],
            rawPayload: this.jsonValue(product.rawPayload),
            ...(!alreadyImported
              ? {
                  status: SupplierProductImportStatus.PENDING_REVIEW,
                  reviewedAt: null,
                  reviewedByUserId: null,
                }
              : {}),
            lastCrawledAt: now,
          },
        });
        if (existing && existing.supplierRetailPriceToman !== product.supplierRetailPriceToman) {
          await transaction.supplierProductSourceChange.create({
            data: {
              draftId: existing.id,
              crawlRunId: run.id,
              type: SupplierProductSourceChangeType.PRICE,
              previousValue: existing.supplierRetailPriceToman?.toString() ?? null,
              newValue: product.supplierRetailPriceToman?.toString() ?? null,
            },
          });
        }
        if (
          existing &&
          product.availability !== SupplierSourceAvailability.UNKNOWN &&
          existing.sourceAvailability !== product.availability
        ) {
          await transaction.supplierProductSourceChange.create({
            data: {
              draftId: existing.id,
              crawlRunId: run.id,
              type: SupplierProductSourceChangeType.AVAILABILITY,
              previousValue: existing.sourceAvailability,
              newValue: product.availability,
            },
          });
        }
        await transaction.supplierCrawlRun.update({
          where: { id: run.id },
          data: {
            status: SupplierCrawlRunStatus.SUCCEEDED,
            discoveredCount: 1,
            succeededCount: 1,
            failedCount: 0,
            finishedAt: now,
          },
        });
        return saved;
      });
      return { runId: run.id, draft };
    } catch (error) {
      await this.prisma.supplierCrawlRun
        .update({
          where: { id: run.id },
          data: {
            status: SupplierCrawlRunStatus.FAILED,
            discoveredCount: 1,
            failedCount: 1,
            errorMessage: this.errorMessage(error),
            finishedAt: new Date(),
          },
        })
        .catch(() => undefined);
      if (error instanceof BadRequestException || error instanceof BadGatewayException) throw error;
      throw new BadGatewayException('Supplier product crawl failed.');
    }
  }

  async updateDraft(draftId: string, dto: UpdateSupplierImportDraftDto, actorUserId: string) {
    const current = await this.prisma.supplierProductImportDraft.findUnique({
      where: { id: draftId },
      select: { id: true, status: true, productId: true },
    });
    if (!current) throw new NotFoundException('Supplier product import draft was not found.');
    if (current.productId || current.status === SupplierProductImportStatus.IMPORTED) {
      throw new ConflictException('An imported draft cannot be edited.');
    }
    if (dto.status === SupplierProductImportStatus.IMPORTED) {
      throw new BadRequestException('A draft becomes imported only when its product is created.');
    }

    const title = dto.title?.trim();
    if (title === '') throw new BadRequestException('Draft title cannot be blank.');
    const attributes = dto.attributes?.map((attribute) => ({
      key: attribute.key.trim(),
      value: attribute.value.trim(),
    }));
    if (attributes?.some((attribute) => !attribute.key || !attribute.value)) {
      throw new BadRequestException('Draft attributes cannot be blank.');
    }
    if (
      attributes &&
      new Set(attributes.map((attribute) => attribute.key.toLocaleLowerCase('fa'))).size !==
        attributes.length
    ) {
      throw new BadRequestException('Draft attribute keys must be unique.');
    }
    const reviewed =
      dto.status === SupplierProductImportStatus.REVIEWED ||
      dto.status === SupplierProductImportStatus.REJECTED;
    const pending = dto.status === SupplierProductImportStatus.PENDING_REVIEW;

    return this.prisma.supplierProductImportDraft.update({
      where: { id: draftId },
      data: {
        ...(title !== undefined ? { title } : {}),
        ...(dto.description !== undefined ? { description: dto.description?.trim() || null } : {}),
        ...(dto.sourceCategory !== undefined
          ? { sourceCategory: dto.sourceCategory?.trim() || null }
          : {}),
        ...(dto.supplierRetailPriceToman !== undefined
          ? { supplierRetailPriceToman: dto.supplierRetailPriceToman }
          : {}),
        ...(dto.weightGrams !== undefined ? { weightGrams: dto.weightGrams } : {}),
        ...(attributes !== undefined ? { attributes: this.jsonValue(attributes) } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(reviewed
          ? { reviewedAt: new Date(), reviewedByUserId: actorUserId }
          : pending
            ? { reviewedAt: null, reviewedByUserId: null }
            : {}),
      },
      include: {
        supplierSource: {
          select: {
            id: true,
            name: true,
            hostname: true,
            supplier: { select: { id: true, name: true, code: true } },
          },
        },
        crawlRun: { select: { id: true, status: true, createdAt: true, finishedAt: true } },
        reviewedBy: { select: { id: true, firstName: true, lastName: true, phone: true } },
        product: { select: { id: true, name: true, slug: true, status: true } },
        importedBy: { select: { id: true, firstName: true, lastName: true, phone: true } },
      },
    });
  }

  async downloadDraftImage(draftId: string, imageIndex: number) {
    const draft = await this.prisma.supplierProductImportDraft.findUnique({
      where: { id: draftId },
      select: {
        title: true,
        imageUrls: true,
        supplierSource: { select: { id: true, hostname: true, adapterKey: true } },
      },
    });
    if (!draft) throw new NotFoundException('Supplier product import draft was not found.');
    const imageUrl = draft.imageUrls[imageIndex];
    if (!imageUrl) throw new NotFoundException('Supplier product image was not found.');
    const url = this.validateSourceUrl(imageUrl, draft.supplierSource);
    const response = await this.fetchResponse(url, draft.supplierSource, 'image');
    const contentType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();
    if (
      !contentType ||
      !['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(contentType)
    ) {
      throw new BadGatewayException('Supplier image response has an unsupported content type.');
    }
    const body = await this.readLimitedBody(response, IMAGE_RESPONSE_LIMIT_BYTES);
    const extension: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/avif': 'avif',
    };
    const safeStem = draft.title
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
    return {
      body,
      contentType,
      filename: `${safeStem || 'supplier-product'}-${imageIndex + 1}.${extension[contentType]}`,
    };
  }

  private async processNextBulkPage(runId: string) {
    const run = await this.prisma.supplierCrawlRun.findUnique({
      where: { id: runId },
      include: {
        supplierSource: {
          include: { supplier: { select: { isActive: true, deletedAt: true } } },
        },
        category: true,
      },
    });
    if (!run || run.status !== SupplierCrawlRunStatus.RUNNING) return;
    if (
      !run.supplierSource.isActive ||
      run.supplierSource.deletedAt ||
      !run.supplierSource.supplier.isActive ||
      run.supplierSource.supplier.deletedAt
    ) {
      await this.failRun(run.id, 'Supplier source is no longer active.');
      return;
    }
    const source: ActiveSupplierSource = run.supplierSource;
    const adapter = this.adapterFor(source);
    let consecutiveKnown = 0;
    try {
      const listingUrl = new URL(adapter.listingUrl(run.targetUrl, run.currentPage));
      const currentCategoryId =
        (await this.resolveCategoryIdFromUrl(source.id, run.targetUrl, adapter)) ?? run.categoryId;
      const listingRequest = adapter.listingRequest(run.targetUrl, run.currentPage);
      const listing = adapter.parseListing(
        await this.fetchListingPayload(listingRequest, source),
        listingUrl.toString(),
      );
      const pendingCategoryUrls = [
        ...new Set([
          ...run.pendingCategoryUrls,
          ...listing.childCategoryUrls.map((value) =>
            this.validateSourceUrl(value, source).toString(),
          ),
        ]),
      ].filter((value) => value !== run.targetUrl);
      let discovered = run.discoveredCount;
      let succeeded = run.succeededCount;
      let failed = run.failedCount;
      let skipped = run.skippedCount;
      if (listing.productUrls.length === 0 && pendingCategoryUrls.length > 0) {
        await this.queueNextBulkPage(run.id, {
          targetUrl: pendingCategoryUrls[0]!,
          pendingCategoryUrls: pendingCategoryUrls.slice(1),
          currentPage: 1,
          discoveredCount: discovered,
          succeededCount: succeeded,
          failedCount: failed,
          skippedCount: skipped,
        });
        return;
      }
      if (
        listing.productUrls.length === 0 &&
        run.currentPage === 1 &&
        discovered === 0 &&
        succeeded === 0 &&
        failed === 0 &&
        skipped === 0
      ) {
        await this.failRun(
          run.id,
          'Supplier listing returned no product links; the crawl was not marked as completed.',
        );
        return;
      }
      for (const productUrl of listing.productUrls) {
        const current = await this.prisma.supplierCrawlRun.findUnique({
          where: { id: run.id },
          select: { status: true },
        });
        if (current?.status === SupplierCrawlRunStatus.PAUSED) return;
        if (
          (run.monitorKnownProducts ? discovered : succeeded + failed) >=
          (run.requestedLimit ?? 100)
        ) {
          await this.finishRun(run.id, discovered, succeeded, failed, skipped);
          return;
        }
        const key = this.productKey(productUrl, adapter);
        const existing = key
          ? await this.prisma.supplierProductImportDraft.findUnique({
              where: {
                supplierSourceId_sourceProductKey: {
                  supplierSourceId: source.id,
                  sourceProductKey: key,
                },
              },
              select: {
                id: true,
                supplierRetailPriceToman: true,
                sourceAvailability: true,
              },
            })
          : null;
        discovered += 1;
        if (existing) {
          if (run.monitorKnownProducts) {
            try {
              await this.refreshKnownProduct(
                run.id,
                source,
                adapter,
                productUrl,
                existing,
                currentCategoryId,
              );
            } catch (error) {
              failed += 1;
              await this.recordCrawlIssue(run.id, productUrl, error);
            }
          }
          skipped += 1;
          consecutiveKnown += 1;
          await this.updateRunProgress(run.id, discovered, succeeded, failed, skipped);
          if (run.stopAtKnown && consecutiveKnown >= 3) {
            await this.finishRun(run.id, discovered, succeeded, failed, skipped);
            return;
          }
          if (run.monitorKnownProducts) await this.delay(source.crawlDelayMs ?? 2000);
          continue;
        }
        consecutiveKnown = 0;
        try {
          await this.importBulkProduct(run.id, source, adapter, productUrl, currentCategoryId);
          succeeded += 1;
        } catch (error) {
          failed += 1;
          await this.recordCrawlIssue(run.id, productUrl, error);
          this.logger.warn(`Supplier product import failed: ${this.errorMessage(error)}`);
        }
        await this.updateRunProgress(run.id, discovered, succeeded, failed, skipped);
        await this.delay(source.crawlDelayMs ?? 2000);
      }
      const latest = await this.prisma.supplierCrawlRun.findUnique({
        where: { id: run.id },
        select: { status: true },
      });
      if (latest?.status === SupplierCrawlRunStatus.PAUSED) return;
      if (
        (run.monitorKnownProducts ? discovered : succeeded + failed) >= (run.requestedLimit ?? 100)
      ) {
        await this.finishRun(run.id, discovered, succeeded, failed, skipped);
        return;
      }
      if (listing.hasNextPage) {
        await this.queueNextBulkPage(run.id, {
          targetUrl: run.targetUrl,
          pendingCategoryUrls,
          currentPage: run.currentPage + 1,
          discoveredCount: discovered,
          succeededCount: succeeded,
          failedCount: failed,
          skippedCount: skipped,
        });
        return;
      }
      if (pendingCategoryUrls.length > 0) {
        await this.queueNextBulkPage(run.id, {
          targetUrl: pendingCategoryUrls[0]!,
          pendingCategoryUrls: pendingCategoryUrls.slice(1),
          currentPage: 1,
          discoveredCount: discovered,
          succeededCount: succeeded,
          failedCount: failed,
          skippedCount: skipped,
        });
        return;
      }
      await this.finishRun(run.id, discovered, succeeded, failed, skipped);
    } catch (error) {
      await this.failRun(run.id, this.errorMessage(error));
    }
  }

  private async importBulkProduct(
    runId: string,
    source: ActiveSupplierSource,
    adapter: SupplierCrawlerAdapter,
    productUrl: string,
    preferredCategoryId: string | null,
  ) {
    const targetUrl = this.validateSourceUrl(productUrl, source);
    const product = adapter.parseProduct(
      await this.fetchText(targetUrl, source),
      targetUrl.toString(),
    );
    const now = new Date();
    const sourceCategoryId = await this.resolveSourceCategoryId(
      source.id,
      product.sourceCategory,
      preferredCategoryId,
    );
    await this.prisma.supplierProductImportDraft.create({
      data: {
        supplierSourceId: source.id,
        crawlRunId: runId,
        sourceProductKey: product.sourceProductKey,
        sourceUrl: product.sourceUrl,
        sourceSku: product.sourceSku,
        title: product.title,
        description: product.description,
        sourceCategory: product.sourceCategory,
        sourceCategoryId,
        supplierRetailPriceToman: product.supplierRetailPriceToman,
        sourceAvailability: product.availability,
        weightGrams: product.weightGrams,
        attributes: this.jsonValue(product.attributes),
        imageUrls: [...product.imageUrls],
        rawPayload: this.jsonValue(product.rawPayload),
        status: SupplierProductImportStatus.PENDING_REVIEW,
        lastCrawledAt: now,
      },
    });
  }

  private async refreshKnownProduct(
    runId: string,
    source: ActiveSupplierSource,
    adapter: SupplierCrawlerAdapter,
    productUrl: string,
    existing: Readonly<{
      id: string;
      supplierRetailPriceToman: number | null;
      sourceAvailability: SupplierSourceAvailability;
    }>,
    preferredCategoryId: string | null,
  ) {
    const targetUrl = this.validateSourceUrl(productUrl, source);
    const product = adapter.parseProduct(
      await this.fetchText(targetUrl, source),
      targetUrl.toString(),
    );
    const sourceCategoryId = await this.resolveSourceCategoryId(
      source.id,
      product.sourceCategory,
      preferredCategoryId,
    );
    const priceChanged = existing.supplierRetailPriceToman !== product.supplierRetailPriceToman;
    const availabilityChanged =
      product.availability !== SupplierSourceAvailability.UNKNOWN &&
      existing.sourceAvailability !== product.availability;
    await this.prisma.$transaction(async (transaction) => {
      await transaction.supplierProductImportDraft.update({
        where: { id: existing.id },
        data: {
          crawlRunId: runId,
          sourceUrl: product.sourceUrl,
          sourceSku: product.sourceSku,
          sourceCategory: product.sourceCategory,
          sourceCategoryId,
          supplierRetailPriceToman: product.supplierRetailPriceToman,
          ...(product.availability === SupplierSourceAvailability.UNKNOWN
            ? {}
            : { sourceAvailability: product.availability }),
          rawPayload: this.jsonValue(product.rawPayload),
          lastCrawledAt: new Date(),
        },
      });
      if (priceChanged) {
        await transaction.supplierProductSourceChange.create({
          data: {
            draftId: existing.id,
            crawlRunId: runId,
            type: SupplierProductSourceChangeType.PRICE,
            previousValue: existing.supplierRetailPriceToman?.toString() ?? null,
            newValue: product.supplierRetailPriceToman?.toString() ?? null,
          },
        });
      }
      if (availabilityChanged) {
        await transaction.supplierProductSourceChange.create({
          data: {
            draftId: existing.id,
            crawlRunId: runId,
            type: SupplierProductSourceChangeType.AVAILABILITY,
            previousValue: existing.sourceAvailability,
            newValue: product.availability,
          },
        });
      }
    });
  }

  private async resolveSourceCategoryId(
    supplierSourceId: string,
    sourceCategory: string | null,
    preferredCategoryId: string | null,
  ) {
    if (preferredCategoryId) return preferredCategoryId;
    if (!sourceCategory) return null;
    const category = await this.prisma.supplierSourceCategory.findFirst({
      where: { supplierSourceId, isActive: true, name: sourceCategory },
      select: { id: true },
    });
    return category?.id ?? null;
  }

  private async resolveCategoryIdFromUrl(
    supplierSourceId: string,
    value: string,
    adapter: SupplierCrawlerAdapter,
  ) {
    let externalKey: string | null = null;
    try {
      externalKey = adapter.categoryKey(new URL(value));
    } catch {
      return null;
    }
    if (!externalKey) return null;
    const category = await this.prisma.supplierSourceCategory.findUnique({
      where: { supplierSourceId_externalKey: { supplierSourceId, externalKey } },
      select: { id: true },
    });
    return category?.id ?? null;
  }

  private async recordCrawlIssue(runId: string, sourceUrl: string, error: unknown) {
    await this.prisma.supplierCrawlIssue.create({
      data: {
        crawlRunId: runId,
        sourceUrl: sourceUrl.slice(0, 2000),
        errorMessage: this.errorMessage(error).slice(0, 1000),
      },
    });
  }

  private async validateScheduleCategories(supplierSourceId: string, categoryIds: string[]) {
    if (categoryIds.length === 0) return [];
    const categories = await this.prisma.supplierSourceCategory.findMany({
      where: { id: { in: categoryIds }, supplierSourceId, isActive: true },
      select: { id: true, name: true, url: true },
    });
    if (categories.length !== categoryIds.length) {
      throw new BadRequestException(
        'One or more selected supplier categories are inactive or invalid.',
      );
    }
    const byId = new Map(categories.map((category) => [category.id, category]));
    return categoryIds.map((categoryId) => byId.get(categoryId)!);
  }

  private async enqueueSchedule(schedule: CrawlScheduleConfig, nextRunAt?: Date) {
    const source = await this.activeSource(schedule.supplierSourceId);
    const adapter = this.adapterFor(source);
    const active = await this.prisma.supplierCrawlRun.findFirst({
      where: {
        supplierSourceId: source.id,
        status: {
          in: [
            SupplierCrawlRunStatus.QUEUED,
            SupplierCrawlRunStatus.RUNNING,
            SupplierCrawlRunStatus.PAUSED,
          ],
        },
      },
      select: { id: true },
    });
    if (active) throw new ConflictException('An unfinished crawl already exists for this source.');
    const categories = await this.validateScheduleCategories(source.id, schedule.categoryIds);
    const firstTarget = categories[0]?.url ?? source.baseUrl!;
    const targetUrl = adapter.listingUrl(firstTarget, 1);
    const pendingCategoryUrls = categories.slice(1).map(({ url }) => url);
    const now = new Date();
    return this.prisma.$transaction(async (transaction) => {
      const run = await transaction.supplierCrawlRun.create({
        data: {
          supplierSourceId: source.id,
          categoryId: categories.length === 1 ? categories[0]!.id : null,
          scheduleId: schedule.id,
          scope: SupplierCrawlScope.SCHEDULED,
          targetUrl,
          pendingCategoryUrls,
          requestedLimit: schedule.requestedLimit,
          stopAtKnown: schedule.stopAtKnown,
          monitorKnownProducts: schedule.monitorKnownProducts,
          maxRetries: schedule.maxRetries,
          retryDelayMinutes: schedule.retryDelayMinutes,
          availableAt: now,
          status: SupplierCrawlRunStatus.QUEUED,
        },
      });
      await transaction.supplierCrawlSchedule.update({
        where: { id: schedule.id },
        data: { lastEnqueuedAt: now, ...(nextRunAt ? { nextRunAt } : {}) },
      });
      return run;
    });
  }

  private nextDailyOccurrence(now: Date, timeOfDay: string, timezone: string) {
    const [hour, minute] = timeOfDay.split(':').map(Number);
    const local = this.zonedParts(now, timezone);
    let candidate = this.zonedDateTimeToUtc(
      local.year,
      local.month,
      local.day,
      hour!,
      minute!,
      timezone,
    );
    if (candidate.getTime() <= now.getTime()) {
      const tomorrow = new Date(Date.UTC(local.year, local.month - 1, local.day) + 86_400_000);
      candidate = this.zonedDateTimeToUtc(
        tomorrow.getUTCFullYear(),
        tomorrow.getUTCMonth() + 1,
        tomorrow.getUTCDate(),
        hour!,
        minute!,
        timezone,
      );
    }
    return candidate;
  }

  private zonedDateTimeToUtc(
    year: number,
    month: number,
    day: number,
    hour: number,
    minute: number,
    timezone: string,
  ) {
    const desired = Date.UTC(year, month - 1, day, hour, minute);
    const guess = new Date(desired);
    const observed = this.zonedParts(guess, timezone);
    const observedValue = Date.UTC(
      observed.year,
      observed.month - 1,
      observed.day,
      observed.hour,
      observed.minute,
    );
    const first = new Date(desired - (observedValue - desired));
    const corrected = this.zonedParts(first, timezone);
    const correctedValue = Date.UTC(
      corrected.year,
      corrected.month - 1,
      corrected.day,
      corrected.hour,
      corrected.minute,
    );
    return new Date(first.getTime() + (desired - correctedValue));
  }

  private zonedParts(value: Date, timezone: string) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(value);
    const part = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((entry) => entry.type === type)?.value);
    return {
      year: part('year'),
      month: part('month'),
      day: part('day'),
      hour: part('hour'),
      minute: part('minute'),
    };
  }

  private async activeSource(sourceId: string) {
    const source = await this.prisma.supplierSource.findFirst({
      where: {
        id: sourceId,
        isActive: true,
        deletedAt: null,
        supplier: { isActive: true, deletedAt: null },
      },
      select: {
        id: true,
        hostname: true,
        adapterKey: true,
        baseUrl: true,
        crawlDelayMs: true,
      },
    });
    if (!source) throw new NotFoundException('Active supplier source was not found.');
    return source;
  }

  private adapterFor(source: ActiveSupplierSource) {
    const adapter = source.adapterKey ? this.adapters.get(source.adapterKey) : undefined;
    if (!adapter) {
      throw new BadRequestException('This supplier source does not have a supported crawler.');
    }
    return adapter;
  }

  private productKey(productUrl: string, adapter: SupplierCrawlerAdapter): string | null {
    try {
      return adapter.productKey(new URL(productUrl));
    } catch {
      return null;
    }
  }

  private async finishRun(
    runId: string,
    discoveredCount: number,
    succeededCount: number,
    failedCount: number,
    skippedCount: number,
  ) {
    const finishedAt = new Date();
    const result = await this.prisma.supplierCrawlRun.updateMany({
      where: { id: runId, status: SupplierCrawlRunStatus.RUNNING },
      data: {
        status: failedCount > 0 ? SupplierCrawlRunStatus.PARTIAL : SupplierCrawlRunStatus.SUCCEEDED,
        discoveredCount,
        succeededCount,
        failedCount,
        skippedCount,
        finishedAt,
        lastHeartbeatAt: finishedAt,
      },
    });
    if (result.count) await this.markScheduleFinished(runId, finishedAt);
  }

  private async failRun(runId: string, errorMessage: string) {
    const run = await this.prisma.supplierCrawlRun.findUnique({
      where: { id: runId },
      select: { retryCount: true, maxRetries: true, retryDelayMinutes: true },
    });
    if (!run) return;
    const now = new Date();
    if (run.retryCount < run.maxRetries) {
      await this.prisma.supplierCrawlRun.updateMany({
        where: { id: runId, status: SupplierCrawlRunStatus.RUNNING },
        data: {
          status: SupplierCrawlRunStatus.QUEUED,
          retryCount: { increment: 1 },
          availableAt: new Date(now.getTime() + run.retryDelayMinutes * 60_000),
          errorMessage,
          lastHeartbeatAt: now,
        },
      });
      return;
    }
    const result = await this.prisma.supplierCrawlRun.updateMany({
      where: { id: runId, status: SupplierCrawlRunStatus.RUNNING },
      data: {
        status: SupplierCrawlRunStatus.FAILED,
        errorMessage,
        finishedAt: now,
        lastHeartbeatAt: now,
      },
    });
    if (result.count) await this.markScheduleFinished(runId, now);
  }

  private async markScheduleFinished(runId: string, finishedAt: Date) {
    const run = await this.prisma.supplierCrawlRun.findUnique({
      where: { id: runId },
      select: { scheduleId: true },
    });
    if (!run?.scheduleId) return;
    await this.prisma.supplierCrawlSchedule.updateMany({
      where: { id: run.scheduleId },
      data: { lastFinishedAt: finishedAt },
    });
  }

  private delay(milliseconds: number) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }

  private queueNextBulkPage(
    runId: string,
    data: Readonly<{
      targetUrl: string;
      pendingCategoryUrls: string[];
      currentPage: number;
      discoveredCount: number;
      succeededCount: number;
      failedCount: number;
      skippedCount: number;
    }>,
  ) {
    return this.prisma.supplierCrawlRun.updateMany({
      where: { id: runId, status: SupplierCrawlRunStatus.RUNNING },
      data: {
        ...data,
        status: SupplierCrawlRunStatus.QUEUED,
        availableAt: new Date(),
        lastHeartbeatAt: new Date(),
      },
    });
  }

  private updateRunProgress(
    runId: string,
    discoveredCount: number,
    succeededCount: number,
    failedCount: number,
    skippedCount: number,
  ) {
    return this.prisma.supplierCrawlRun.updateMany({
      where: { id: runId, status: SupplierCrawlRunStatus.RUNNING },
      data: {
        discoveredCount,
        succeededCount,
        failedCount,
        skippedCount,
        lastHeartbeatAt: new Date(),
      },
    });
  }

  private async fetchListingPayload(
    request: ReturnType<SupplierCrawlerAdapter['listingRequest']>,
    source: ActiveSupplierSource,
  ): Promise<string> {
    const url = this.validateSourceUrl(request.url, source);
    const referer = this.validateSourceUrl(request.referer, source);
    if (!request.requiresXsrfSession) {
      const response = await this.fetchResponse(url, source, 'document', {
        method: request.method,
        body: request.body,
        headers: {
          Accept: 'application/json,text/html,application/xhtml+xml',
          ...(request.contentType ? { 'Content-Type': request.contentType } : {}),
          Referer: referer.toString(),
        },
      });
      return (await this.readLimitedBody(response, HTML_RESPONSE_LIMIT_BYTES)).toString('utf8');
    }
    const sessionResponse = await this.fetchResponse(referer, source, 'document');
    await this.readLimitedBody(sessionResponse, HTML_RESPONSE_LIMIT_BYTES);
    const setCookies = sessionResponse.headers.getSetCookie();
    const cookies = setCookies
      .map((value) => value.split(';', 1)[0]?.trim())
      .filter((value): value is string => Boolean(value));
    const xsrfCookie = cookies.find((value) => value.startsWith('XSRF-TOKEN='));
    if (!xsrfCookie) {
      throw new BadGatewayException('Supplier listing session did not provide an XSRF token.');
    }
    let xsrfToken: string;
    try {
      xsrfToken = decodeURIComponent(xsrfCookie.slice('XSRF-TOKEN='.length));
    } catch {
      throw new BadGatewayException('Supplier listing session returned an invalid XSRF token.');
    }
    const response = await this.fetchResponse(
      url,
      source,
      'document',
      {
        method: request.method,
        body: request.body,
        headers: {
          Accept: 'application/json, text/javascript, */*; q=0.01',
          ...(request.contentType ? { 'Content-Type': request.contentType } : {}),
          Cookie: cookies.join('; '),
          'X-XSRF-TOKEN': xsrfToken,
          'X-Requested-With': 'XMLHttpRequest',
          Referer: referer.toString(),
        },
      },
      false,
    );
    return (await this.readLimitedBody(response, HTML_RESPONSE_LIMIT_BYTES)).toString('utf8');
  }

  private validateSourceUrl(value: string, source: ActiveSupplierSource): URL {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new BadRequestException('Supplier URL is invalid.');
    }
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.hostname.toLowerCase() !== source.hostname.toLowerCase()
    ) {
      throw new BadRequestException(
        'Supplier URL must belong to the configured supplier hostname.',
      );
    }
    url.hash = '';
    return url;
  }

  private async fetchText(url: URL, source: ActiveSupplierSource): Promise<string> {
    const response = await this.fetchResponse(url, source, 'document');
    const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
    if (!contentType.includes('text/html')) {
      throw new BadGatewayException('Supplier product response is not HTML.');
    }
    return (await this.readLimitedBody(response, HTML_RESPONSE_LIMIT_BYTES)).toString('utf8');
  }

  private async fetchResponse(
    initialUrl: URL,
    source: ActiveSupplierSource,
    destination: 'document' | 'image',
    init: RequestInit = {},
    followRedirects = true,
  ): Promise<Response> {
    let url = initialUrl;
    for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
      let response: Response | null = null;
      let lastRequestError: unknown = null;
      for (let attempt = 1; attempt <= CRAWL_REQUEST_ATTEMPTS; attempt += 1) {
        try {
          response = await fetch(url, {
            ...init,
            redirect: 'manual',
            signal: AbortSignal.timeout(CRAWL_TIMEOUT_MS),
            headers: {
              Accept:
                destination === 'image'
                  ? 'image/avif,image/webp,image/png,image/jpeg'
                  : 'text/html,application/xhtml+xml',
              'User-Agent':
                'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 HamidianSilverSupplierImporter/1.0',
              ...init.headers,
            },
          });
          if (![408, 425, 429, 500, 502, 503, 504].includes(response.status)) break;
          lastRequestError = new Error(`Supplier returned retryable HTTP ${response.status}.`);
        } catch (error) {
          lastRequestError = error;
        }
        if (attempt < CRAWL_REQUEST_ATTEMPTS) {
          const retryAfterSeconds = Number(response?.headers.get('retry-after') ?? Number.NaN);
          const delayMs = Number.isFinite(retryAfterSeconds)
            ? Math.min(retryAfterSeconds * 1000, 60_000)
            : CRAWL_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);
          await this.delay(delayMs);
        }
      }
      if (!response || [408, 425, 429, 500, 502, 503, 504].includes(response.status)) {
        this.logger.warn(
          `Supplier request exhausted retries: ${this.errorMessage(lastRequestError)}`,
        );
        throw new BadGatewayException('Supplier website did not respond after several attempts.');
      }
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        if (!followRedirects) {
          throw new BadGatewayException('Supplier listing request was redirected unexpectedly.');
        }
        const location = response.headers.get('location');
        if (!location || redirect === MAX_REDIRECTS) {
          throw new BadGatewayException('Supplier website returned too many redirects.');
        }
        url = this.validateSourceUrl(new URL(location, url).toString(), source);
        continue;
      }
      if (!response.ok) {
        throw new BadGatewayException(`Supplier website returned HTTP ${response.status}.`);
      }
      return response;
    }
    throw new BadGatewayException('Supplier website returned too many redirects.');
  }

  private async readLimitedBody(response: Response, limit: number): Promise<Buffer> {
    const declaredLength = Number(response.headers.get('content-length') ?? '0');
    if (Number.isFinite(declaredLength) && declaredLength > limit) {
      throw new BadGatewayException('Supplier response exceeds the allowed size.');
    }
    if (!response.body) return Buffer.alloc(0);
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of response.body) {
      const buffer = Buffer.from(chunk);
      size += buffer.byteLength;
      if (size > limit)
        throw new BadGatewayException('Supplier response exceeds the allowed size.');
      chunks.push(buffer);
    }
    return Buffer.concat(chunks);
  }

  private jsonValue(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }

  private errorMessage(error: unknown): string {
    const message = error instanceof Error ? error.message : 'Supplier product crawl failed.';
    return message.replace(/[\r\n\t]+/g, ' ').slice(0, 1000);
  }
}
