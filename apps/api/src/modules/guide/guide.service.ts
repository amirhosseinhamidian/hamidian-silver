import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import {
  GuideArticleFormat,
  GuideArticleStatus,
  ProductStatus,
  SeoRedirectEntityType,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { PublicMediaUrlService } from '../catalog/public-media-url.service';
import { recordSeoSlugChange } from '../seo/seo-redirects.service';
import type {
  CreateGuideArticleDto,
  GuideArticleStatusDto,
  UpdateGuideArticleDto,
} from './dto/guide-article-input.dto';
import type {
  AdminGuideArticlesQueryDto,
  PublicGuideArticlesQueryDto,
  PublicRelatedGuideArticlesQueryDto,
} from './dto/guide-query.dto';
import type { CreateGuideTopicDto, UpdateGuideTopicDto } from './dto/guide-topic-input.dto';

const mediaSelect = { id: true, storageKey: true, mimeType: true, altText: true } as const;
const topicInclude = { coverMedia: { select: mediaSelect } } as const;
const articleSummaryInclude = {
  heroMedia: { select: mediaSelect },
  seoOgMedia: { select: mediaSelect },
  blocks: { select: { id: true } },
  topics: { include: { topic: { include: topicInclude } } },
  products: { select: { productId: true } },
  categories: { select: { categoryId: true } },
  brands: { select: { brandId: true } },
} as const;
const articleInclude = {
  heroMedia: { select: mediaSelect },
  heroMobileMedia: { select: mediaSelect },
  seoOgMedia: { select: mediaSelect },
  blocks: {
    orderBy: { sortOrder: 'asc' as const },
    include: { primaryMedia: { select: mediaSelect } },
  },
  topics: { include: { topic: { include: topicInclude } } },
  products: {
    orderBy: { sortOrder: 'asc' as const },
    select: {
      productId: true,
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          shortDescription: true,
          salePriceToman: true,
          status: true,
          deletedAt: true,
          media: {
            orderBy: { sortOrder: 'asc' as const },
            select: {
              isPrimary: true,
              altText: true,
              media: { select: mediaSelect },
            },
          },
        },
      },
    },
  },
  categories: {
    select: {
      categoryId: true,
      category: {
        select: { id: true, name: true, slug: true, isActive: true, deletedAt: true },
      },
    },
  },
  brands: {
    select: {
      brandId: true,
      brand: {
        select: { id: true, name: true, slug: true, isActive: true, deletedAt: true },
      },
    },
  },
} as const;

type GuideMedia = { id: string; storageKey: string; mimeType: string; altText: string | null };

@Injectable()
export class GuideService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaUrls: PublicMediaUrlService,
  ) {}

  async listPublicTopics() {
    const rows = await this.prisma.guideTopic.findMany({
      where: { isActive: true, deletedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: topicInclude,
    });
    return rows.map((row) => this.projectTopic(row));
  }

  listPublicArticles(query: PublicGuideArticlesQueryDto) {
    return this.listArticles(query, true);
  }

  listAdminArticles(query: AdminGuideArticlesQueryDto) {
    return this.listArticles(query, false);
  }

  async getPublicArticle(slug: string) {
    const row = await this.prisma.guideArticle.findFirst({
      where: { slug, ...this.publicArticleWhere() },
      include: articleInclude,
    });
    if (!row) throw new NotFoundException('Guide article was not found.');
    const relatedArticles = await this.findRelatedArticles(row);
    return this.projectArticle(row, relatedArticles);
  }

  async listPublicRelatedArticles(query: PublicRelatedGuideArticlesQueryDto) {
    const categories = [...new Set(query.categories ?? [])];
    const contexts: Prisma.GuideArticleWhereInput[] = [];
    if (query.product) {
      contexts.push({
        products: {
          some: {
            product: {
              slug: query.product,
              status: ProductStatus.ACTIVE,
              deletedAt: null,
            },
          },
        },
      });
    }
    if (categories.length) {
      contexts.push({
        categories: {
          some: {
            category: { slug: { in: categories }, isActive: true, deletedAt: null },
          },
        },
      });
    }
    if (query.brand) {
      contexts.push({
        brands: {
          some: { brand: { slug: query.brand, isActive: true, deletedAt: null } },
        },
      });
    }
    if (!contexts.length) return [];

    const rows = await this.prisma.guideArticle.findMany({
      where: {
        ...this.publicArticleWhere(),
        seoNoIndex: false,
        OR: contexts,
      },
      orderBy: [{ isFeatured: 'desc' }, { publishedAt: 'desc' }, { updatedAt: 'desc' }],
      take: query.limit ?? 3,
      include: articleSummaryInclude,
    });
    return rows.map((row) => this.projectSummary(row));
  }

  async getAdminArticle(id: string) {
    const row = await this.prisma.guideArticle.findFirst({
      where: { id, deletedAt: null },
      include: articleInclude,
    });
    if (!row) throw new NotFoundException('Guide article was not found.');
    return this.projectArticle(row);
  }

  async createArticle(dto: CreateGuideArticleDto, userId: string) {
    const input = this.normalizeArticle(dto);
    await this.validateArticleInput(input, input.status === GuideArticleStatus.PUBLISHED);
    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const row = await tx.guideArticle.create({
          data: {
            title: input.title,
            slug: input.slug,
            eyebrow: input.eyebrow,
            excerpt: input.excerpt,
            format: input.format,
            status: input.status,
            heroMediaId: input.heroMediaId,
            heroMobileMediaId: input.heroMobileMediaId,
            seoTitle: input.seoTitle,
            seoDescription: input.seoDescription,
            seoCanonicalPath: input.seoCanonicalPath,
            seoNoIndex: input.seoNoIndex,
            seoOgMediaId: input.seoOgMediaId,
            searchKeywords: input.searchKeywords,
            readingTimeMinutes: input.readingTimeMinutes,
            isFeatured: input.isFeatured,
            publishedAt: input.status === GuideArticleStatus.PUBLISHED ? new Date() : null,
            createdByUserId: userId,
            updatedByUserId: userId,
            blocks: { create: input.blocks },
            topics: { create: input.topicIds.map((topicId) => ({ topicId })) },
            products: {
              create: input.productIds.map((productId, sortOrder) => ({ productId, sortOrder })),
            },
            categories: { create: input.categoryIds.map((categoryId) => ({ categoryId })) },
            brands: { create: input.brandIds.map((brandId) => ({ brandId })) },
          },
          select: { id: true },
        });
        return row;
      });
      return this.getAdminArticle(created.id);
    } catch (error) {
      this.rethrowKnownDatabaseConflict(error);
    }
  }

  async updateArticle(id: string, dto: UpdateGuideArticleDto, userId: string) {
    const existing = await this.prisma.guideArticle.findFirst({
      where: { id, deletedAt: null },
      include: articleInclude,
    });
    if (!existing) throw new NotFoundException('Guide article was not found.');
    if (existing.version !== dto.expectedVersion)
      throw new ConflictException(
        'This guide was changed by another editor. Refresh and try again.',
      );

    const input = this.normalizeArticle({
      ...existing,
      ...dto,
      blocks:
        dto.blocks ??
        existing.blocks.map(({ type, variant, anchorId, primaryMediaId, content, sortOrder }) => ({
          type,
          variant,
          anchorId,
          primaryMediaId,
          content: content as Record<string, unknown>,
          sortOrder,
        })),
      topicIds: dto.topicIds ?? existing.topics.map(({ topicId }) => topicId),
      productIds: dto.productIds ?? existing.products.map(({ productId }) => productId),
      categoryIds: dto.categoryIds ?? existing.categories.map(({ categoryId }) => categoryId),
      brandIds: dto.brandIds ?? existing.brands.map(({ brandId }) => brandId),
    });
    await this.validateArticleInput(input, input.status === GuideArticleStatus.PUBLISHED);

    try {
      await this.prisma.$transaction(async (tx) => {
        const updated = await tx.guideArticle.updateMany({
          where: { id, deletedAt: null, version: dto.expectedVersion },
          data: {
            title: input.title,
            slug: input.slug,
            eyebrow: input.eyebrow,
            excerpt: input.excerpt,
            format: input.format,
            status: input.status,
            heroMediaId: input.heroMediaId,
            heroMobileMediaId: input.heroMobileMediaId,
            seoTitle: input.seoTitle,
            seoDescription: input.seoDescription,
            seoCanonicalPath: input.seoCanonicalPath,
            seoNoIndex: input.seoNoIndex,
            seoOgMediaId: input.seoOgMediaId,
            searchKeywords: input.searchKeywords,
            readingTimeMinutes: input.readingTimeMinutes,
            isFeatured: input.isFeatured,
            updatedByUserId: userId,
            publishedAt:
              input.status === GuideArticleStatus.PUBLISHED
                ? (existing.publishedAt ?? new Date())
                : existing.publishedAt,
            version: { increment: 1 },
          },
        });
        if (updated.count !== 1)
          throw new ConflictException(
            'This guide was changed by another editor. Refresh and try again.',
          );
        await Promise.all([
          tx.guideArticleBlock.deleteMany({ where: { articleId: id } }),
          tx.guideArticleTopic.deleteMany({ where: { articleId: id } }),
          tx.guideArticleProduct.deleteMany({ where: { articleId: id } }),
          tx.guideArticleCategory.deleteMany({ where: { articleId: id } }),
          tx.guideArticleBrand.deleteMany({ where: { articleId: id } }),
        ]);
        if (input.blocks.length)
          await tx.guideArticleBlock.createMany({
            data: input.blocks.map((block) => ({ ...block, articleId: id })),
          });
        if (input.topicIds.length)
          await tx.guideArticleTopic.createMany({
            data: input.topicIds.map((topicId) => ({ articleId: id, topicId })),
          });
        if (input.productIds.length)
          await tx.guideArticleProduct.createMany({
            data: input.productIds.map((productId, sortOrder) => ({
              articleId: id,
              productId,
              sortOrder,
            })),
          });
        if (input.categoryIds.length)
          await tx.guideArticleCategory.createMany({
            data: input.categoryIds.map((categoryId) => ({ articleId: id, categoryId })),
          });
        if (input.brandIds.length)
          await tx.guideArticleBrand.createMany({
            data: input.brandIds.map((brandId) => ({ articleId: id, brandId })),
          });
        await recordSeoSlugChange(
          tx,
          SeoRedirectEntityType.GUIDE_ARTICLE,
          id,
          existing.slug,
          input.slug,
        );
      });
      return this.getAdminArticle(id);
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      this.rethrowKnownDatabaseConflict(error);
    }
  }

  updateArticleStatus(id: string, dto: GuideArticleStatusDto, userId: string) {
    return this.updateArticle(
      id,
      { status: dto.status, expectedVersion: dto.expectedVersion },
      userId,
    );
  }

  async deleteArticle(id: string, expectedVersion: number, userId: string) {
    const updated = await this.prisma.guideArticle.updateMany({
      where: { id, deletedAt: null, version: expectedVersion },
      data: {
        deletedAt: new Date(),
        status: GuideArticleStatus.ARCHIVED,
        updatedByUserId: userId,
        version: { increment: 1 },
      },
    });
    if (!updated.count)
      throw new ConflictException('Guide not found or it was changed by another editor.');
    return { deleted: true };
  }

  async listAdminTopics() {
    const rows = await this.prisma.guideTopic.findMany({
      where: { deletedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: topicInclude,
    });
    return rows.map((row) => this.projectTopic(row));
  }

  async createTopic(dto: CreateGuideTopicDto) {
    await this.validateMediaIds([dto.coverMediaId, dto.seoOgMediaId]);
    try {
      const row = await this.prisma.guideTopic.create({
        data: {
          name: dto.name.trim(),
          slug: dto.slug.trim().toLowerCase(),
          description: dto.description?.trim() || null,
          coverMediaId: dto.coverMediaId ?? null,
          seoTitle: dto.seoTitle?.trim() || null,
          seoDescription: dto.seoDescription?.trim() || null,
          seoCanonicalPath: dto.seoCanonicalPath?.trim() || null,
          seoNoIndex: dto.seoNoIndex ?? false,
          seoOgMediaId: dto.seoOgMediaId ?? null,
          sortOrder: dto.sortOrder ?? 0,
          isActive: dto.isActive ?? true,
        },
        include: topicInclude,
      });
      return this.projectTopic(row);
    } catch (error) {
      this.rethrowKnownDatabaseConflict(error);
    }
  }

  async updateTopic(id: string, dto: UpdateGuideTopicDto) {
    const existing = await this.prisma.guideTopic.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new NotFoundException('Guide topic was not found.');
    await this.validateMediaIds([dto.coverMediaId, dto.seoOgMediaId]);
    try {
      const row = await this.prisma.guideTopic.update({
        where: { id },
        data: this.normalizeTopic(dto),
        include: topicInclude,
      });
      return this.projectTopic(row);
    } catch (error) {
      this.rethrowKnownDatabaseConflict(error);
    }
  }

  async deleteTopic(id: string) {
    const linked = await this.prisma.guideArticleTopic.count({
      where: { topicId: id, article: { deletedAt: null } },
    });
    if (linked)
      throw new ConflictException('Remove this topic from guide articles before deleting it.');
    const result = await this.prisma.guideTopic.updateMany({
      where: { id, deletedAt: null },
      data: { deletedAt: new Date(), isActive: false },
    });
    if (!result.count) throw new NotFoundException('Guide topic was not found.');
    return { deleted: true };
  }

  private async listArticles(query: AdminGuideArticlesQueryDto, publicOnly: boolean) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 12;
    const q = query.q?.trim();
    const where: Prisma.GuideArticleWhereInput = {
      deletedAt: null,
      ...(publicOnly ? this.publicArticleWhere() : query.status ? { status: query.status } : {}),
      ...(query.format ? { format: query.format } : {}),
      ...(query.featured === undefined ? {} : { isFeatured: query.featured }),
      ...(query.topic
        ? { topics: { some: { topic: { slug: query.topic, isActive: true, deletedAt: null } } } }
        : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: 'insensitive' } },
              { excerpt: { contains: q, mode: 'insensitive' } },
              { searchKeywords: { has: q } },
            ],
          }
        : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.guideArticle.findMany({
        where,
        orderBy: [{ isFeatured: 'desc' }, { publishedAt: 'desc' }, { updatedAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: articleSummaryInclude,
      }),
      this.prisma.guideArticle.count({ where }),
    ]);
    return {
      items: rows.map((row) => this.projectSummary(row)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  private publicArticleWhere(): Prisma.GuideArticleWhereInput {
    return {
      status: GuideArticleStatus.PUBLISHED,
      publishedAt: { lte: new Date() },
      deletedAt: null,
    };
  }

  private normalizeArticle(dto: CreateGuideArticleDto) {
    const clean = (value?: string | null) => value?.trim() || null;
    return {
      title: dto.title.trim(),
      slug: dto.slug.trim().toLowerCase(),
      eyebrow: clean(dto.eyebrow),
      excerpt: clean(dto.excerpt),
      format: dto.format ?? GuideArticleFormat.GUIDE,
      status: dto.status ?? GuideArticleStatus.DRAFT,
      heroMediaId: dto.heroMediaId ?? null,
      heroMobileMediaId: dto.heroMobileMediaId ?? null,
      seoTitle: clean(dto.seoTitle),
      seoDescription: clean(dto.seoDescription),
      seoCanonicalPath: clean(dto.seoCanonicalPath),
      seoNoIndex: dto.seoNoIndex ?? false,
      seoOgMediaId: dto.seoOgMediaId ?? null,
      searchKeywords: [
        ...new Set((dto.searchKeywords ?? []).map((item) => item.trim()).filter(Boolean)),
      ],
      readingTimeMinutes: dto.readingTimeMinutes ?? null,
      isFeatured: dto.isFeatured ?? false,
      blocks: (dto.blocks ?? []).map((block) => ({
        type: block.type,
        variant: clean(block.variant),
        anchorId: clean(block.anchorId),
        primaryMediaId: block.primaryMediaId ?? null,
        content: block.content as Prisma.InputJsonValue,
        sortOrder: block.sortOrder,
      })),
      topicIds: dto.topicIds ?? [],
      productIds: dto.productIds ?? [],
      categoryIds: dto.categoryIds ?? [],
      brandIds: dto.brandIds ?? [],
    };
  }

  private normalizeTopic(dto: CreateGuideTopicDto | UpdateGuideTopicDto) {
    const clean = (value?: string | null) => value?.trim() || null;
    return {
      ...(dto.name === undefined ? {} : { name: dto.name.trim() }),
      ...(dto.slug === undefined ? {} : { slug: dto.slug.trim().toLowerCase() }),
      ...(dto.description === undefined ? {} : { description: clean(dto.description) }),
      ...(dto.coverMediaId === undefined ? {} : { coverMediaId: dto.coverMediaId }),
      ...(dto.seoTitle === undefined ? {} : { seoTitle: clean(dto.seoTitle) }),
      ...(dto.seoDescription === undefined ? {} : { seoDescription: clean(dto.seoDescription) }),
      ...(dto.seoCanonicalPath === undefined
        ? {}
        : { seoCanonicalPath: clean(dto.seoCanonicalPath) }),
      ...(dto.seoNoIndex === undefined ? {} : { seoNoIndex: dto.seoNoIndex }),
      ...(dto.seoOgMediaId === undefined ? {} : { seoOgMediaId: dto.seoOgMediaId }),
      ...(dto.sortOrder === undefined ? {} : { sortOrder: dto.sortOrder }),
      ...(dto.isActive === undefined ? {} : { isActive: dto.isActive }),
    };
  }

  private async validateArticleInput(
    input: ReturnType<GuideService['normalizeArticle']>,
    publishing: boolean,
  ) {
    const orders = input.blocks.map((block) => block.sortOrder);
    const anchors = input.blocks.map((block) => block.anchorId).filter(Boolean);
    if (new Set(orders).size !== orders.length)
      throw new BadRequestException('Block sortOrder values must be unique.');
    if (new Set(anchors).size !== anchors.length)
      throw new BadRequestException('Block anchorId values must be unique.');
    for (const block of input.blocks) this.validateBlockContent(block);
    if (publishing && (!input.excerpt || !input.blocks.length))
      throw new BadRequestException(
        'A published guide requires an excerpt and at least one content block.',
      );
    await Promise.all([
      this.validateMediaIds([
        input.heroMediaId,
        input.heroMobileMediaId,
        input.seoOgMediaId,
        ...input.blocks.map((block) => block.primaryMediaId),
      ]),
      this.validateReferences('guideTopic', input.topicIds, { isActive: true, deletedAt: null }),
      this.validateReferences('product', input.productIds, {
        status: ProductStatus.ACTIVE,
        deletedAt: null,
      }),
      this.validateReferences('category', input.categoryIds, { isActive: true, deletedAt: null }),
      this.validateReferences('brand', input.brandIds, { isActive: true, deletedAt: null }),
    ]);
  }

  private validateBlockContent(block: { content: unknown; sortOrder: number }) {
    const serialized = JSON.stringify(block.content);
    if (Buffer.byteLength(serialized, 'utf8') > 100_000)
      throw new BadRequestException(`Block ${block.sortOrder} exceeds the 100 KB content limit.`);
    if (/<\/?[a-z][^>]*>/i.test(serialized))
      throw new BadRequestException(
        'Raw HTML is not accepted in guide blocks. Use structured content fields.',
      );
  }

  private async validateMediaIds(ids: Array<string | null | undefined>) {
    const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
    if (!unique.length) return;
    const count = await this.prisma.media.count({
      where: { id: { in: unique }, deletedAt: null, mimeType: { startsWith: 'image/' } },
    });
    if (count !== unique.length)
      throw new BadRequestException('One or more guide media IDs are missing or are not images.');
  }

  private async validateReferences(
    model: 'guideTopic' | 'product' | 'category' | 'brand',
    ids: string[],
    where: Record<string, unknown>,
  ) {
    const unique = [...new Set(ids)];
    if (!unique.length) return;
    const count = await (
      this.prisma[model] as unknown as { count(args: unknown): Promise<number> }
    ).count({ where: { id: { in: unique }, ...where } });
    if (count !== unique.length)
      throw new BadRequestException(`One or more ${model} references are unavailable.`);
  }

  private projectMedia(media: GuideMedia | null) {
    return media
      ? {
          id: media.id,
          url: this.mediaUrls.resolve(media.storageKey),
          mimeType: media.mimeType,
          altText: media.altText,
        }
      : null;
  }

  private projectTopic(row: any) {
    return { ...row, coverMedia: this.projectMedia(row.coverMedia) };
  }

  private projectSummary(row: any) {
    return {
      id: row.id,
      title: row.title,
      slug: row.slug,
      eyebrow: row.eyebrow,
      excerpt: row.excerpt,
      format: row.format,
      status: row.status,
      heroMedia: this.projectMedia(row.heroMedia),
      seoCanonicalPath: row.seoCanonicalPath,
      seoNoIndex: row.seoNoIndex,
      seoOgMedia: this.projectMedia(row.seoOgMedia),
      readingTimeMinutes: row.readingTimeMinutes,
      isFeatured: row.isFeatured,
      blockCount: row.blocks.length,
      publishedAt: row.publishedAt,
      topics: row.topics.map(({ topic }: any) => this.projectTopic(topic)),
      version: row.version,
      updatedAt: row.updatedAt,
    };
  }

  private projectArticle(row: any, relatedArticles: readonly any[] = []) {
    return {
      ...this.projectSummary(row),
      heroMobileMedia: this.projectMedia(row.heroMobileMedia),
      seoTitle: row.seoTitle,
      seoDescription: row.seoDescription,
      searchKeywords: row.searchKeywords,
      blocks: row.blocks.map((block: any) => ({
        id: block.id,
        type: block.type,
        variant: block.variant,
        anchorId: block.anchorId,
        primaryMedia: this.projectMedia(block.primaryMedia),
        content: block.content,
        sortOrder: block.sortOrder,
      })),
      productIds: row.products.map(({ productId }: any) => productId),
      relatedProducts: row.products.flatMap(({ product }: any) => {
        if (product.status !== ProductStatus.ACTIVE || product.deletedAt) return [];
        const primary = product.media.find(({ isPrimary }: any) => isPrimary) ?? product.media[0];
        return [
          {
            id: product.id,
            name: product.name,
            slug: product.slug,
            shortDescription: product.shortDescription,
            salePriceToman: product.salePriceToman,
            primaryMedia: primary
              ? this.projectMedia({
                  ...primary.media,
                  altText: primary.altText ?? primary.media.altText,
                })
              : null,
          },
        ];
      }),
      categoryIds: row.categories.map(({ categoryId }: any) => categoryId),
      relatedCategories: row.categories.flatMap(({ category }: any) =>
        category?.isActive && !category.deletedAt
          ? [{ id: category.id, name: category.name, slug: category.slug }]
          : [],
      ),
      brandIds: row.brands.map(({ brandId }: any) => brandId),
      relatedBrands: row.brands.flatMap(({ brand }: any) =>
        brand?.isActive && !brand.deletedAt
          ? [{ id: brand.id, name: brand.name, slug: brand.slug }]
          : [],
      ),
      relatedArticles,
      createdAt: row.createdAt,
    };
  }

  private async findRelatedArticles(source: any) {
    const topicIds: string[] = source.topics.map(({ topicId, topic }: any) => topicId ?? topic.id);
    const productIds: string[] = source.products.map(({ productId }: any) => productId);
    const categoryIds: string[] = source.categories.map(({ categoryId }: any) => categoryId);
    const brandIds: string[] = source.brands.map(({ brandId }: any) => brandId);
    const relations: Prisma.GuideArticleWhereInput[] = [];
    if (topicIds.length) relations.push({ topics: { some: { topicId: { in: topicIds } } } });
    if (productIds.length)
      relations.push({ products: { some: { productId: { in: productIds } } } });
    if (categoryIds.length)
      relations.push({ categories: { some: { categoryId: { in: categoryIds } } } });
    if (brandIds.length) relations.push({ brands: { some: { brandId: { in: brandIds } } } });

    const candidates = await this.prisma.guideArticle.findMany({
      where: {
        ...this.publicArticleWhere(),
        id: { not: source.id },
        seoNoIndex: false,
        ...(relations.length ? { OR: relations } : {}),
      },
      orderBy: [{ isFeatured: 'desc' }, { publishedAt: 'desc' }, { updatedAt: 'desc' }],
      take: 24,
      include: articleSummaryInclude,
    });

    const sourceTopics = new Set(topicIds);
    const sourceProducts = new Set(productIds);
    const sourceCategories = new Set(categoryIds);
    const sourceBrands = new Set(brandIds);
    const overlap = (values: readonly string[], sourceValues: Set<string>) =>
      values.reduce((count, value) => count + Number(sourceValues.has(value)), 0);
    const score = (candidate: any) =>
      overlap(
        candidate.products.map(({ productId }: any) => productId),
        sourceProducts,
      ) *
        8 +
      overlap(
        candidate.categories.map(({ categoryId }: any) => categoryId),
        sourceCategories,
      ) *
        4 +
      overlap(
        candidate.brands.map(({ brandId }: any) => brandId),
        sourceBrands,
      ) *
        3 +
      overlap(
        candidate.topics.map(({ topicId, topic }: any) => topicId ?? topic.id),
        sourceTopics,
      ) *
        2;

    return candidates
      .map((candidate, position) => ({ candidate, position, score: score(candidate) }))
      .sort((left, right) => right.score - left.score || left.position - right.position)
      .slice(0, 3)
      .map(({ candidate }) => this.projectSummary(candidate));
  }

  private rethrowKnownDatabaseConflict(error: unknown): never {
    if (typeof error === 'object' && error && 'code' in error && error.code === 'P2002')
      throw new ConflictException('The guide slug is already in use.');
    throw error;
  }
}
