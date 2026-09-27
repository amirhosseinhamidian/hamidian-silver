import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import {
  SupplierCrawlRunStatus,
  SupplierCrawlScope,
  SupplierProductImportStatus,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { BsjSilverCrawlerAdapter } from './adapters/bsj-silver-crawler.adapter';
import { ListSupplierImportDraftsQueryDto } from './dto/list-supplier-import-drafts-query.dto';
import { StartSupplierCrawlDto } from './dto/start-supplier-crawl.dto';
import { UpdateSupplierImportDraftDto } from './dto/update-supplier-import-draft.dto';
import type { SupplierCrawlerAdapter } from './supplier-crawler.types';

const HTML_RESPONSE_LIMIT_BYTES = 5 * 1024 * 1024;
const IMAGE_RESPONSE_LIMIT_BYTES = 10 * 1024 * 1024;
const CRAWL_TIMEOUT_MS = 20_000;
const MAX_REDIRECTS = 3;

type ActiveSupplierSource = Readonly<{
  id: string;
  hostname: string;
  adapterKey: string | null;
}>;

@Injectable()
export class SupplierImportsService {
  private readonly adapters: ReadonlyMap<string, SupplierCrawlerAdapter>;

  constructor(
    private readonly prisma: PrismaService,
    bsjSilverAdapter: BsjSilverCrawlerAdapter,
  ) {
    this.adapters = new Map([[bsjSilverAdapter.key, bsjSilverAdapter]]);
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

  listDrafts(query: ListSupplierImportDraftsQueryDto) {
    return this.prisma.supplierProductImportDraft.findMany({
      where: {
        ...(query.status ? { status: query.status } : {}),
        ...(query.supplierSourceId ? { supplierSourceId: query.supplierSourceId } : {}),
      },
      take: 200,
      orderBy: { updatedAt: 'desc' },
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
      },
    });
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
    if (!/^\/product\/\d+(?:-|\/|$)/.test(targetUrl.pathname)) {
      throw new BadRequestException('The target URL must be a supplier product page.');
    }

    const running = await this.prisma.supplierCrawlRun.findFirst({
      where: { supplierSourceId: source.id, status: SupplierCrawlRunStatus.RUNNING },
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
            supplierRetailPriceToman: product.supplierRetailPriceToman,
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
            supplierRetailPriceToman: product.supplierRetailPriceToman,
            weightGrams: product.weightGrams,
            attributes: this.jsonValue(product.attributes),
            imageUrls: [...product.imageUrls],
            rawPayload: this.jsonValue(product.rawPayload),
            status: SupplierProductImportStatus.PENDING_REVIEW,
            reviewedAt: null,
            reviewedByUserId: null,
            lastCrawledAt: now,
          },
        });
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
      select: { id: true },
    });
    if (!current) throw new NotFoundException('Supplier product import draft was not found.');

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
  ): Promise<Response> {
    let url = initialUrl;
    for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
      let response: Response;
      try {
        response = await fetch(url, {
          redirect: 'manual',
          signal: AbortSignal.timeout(CRAWL_TIMEOUT_MS),
          headers: {
            Accept:
              destination === 'image'
                ? 'image/avif,image/webp,image/png,image/jpeg'
                : 'text/html,application/xhtml+xml',
            'User-Agent': 'HamidianSilverSupplierImporter/1.0',
          },
        });
      } catch {
        throw new BadGatewayException('Supplier website did not respond in time.');
      }
      if ([301, 302, 303, 307, 308].includes(response.status)) {
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
