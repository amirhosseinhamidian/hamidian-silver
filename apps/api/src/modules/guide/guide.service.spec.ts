import { BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import {
  GuideArticleFormat,
  GuideArticleStatus,
  GuideBlockType,
  GuideProductRecommendationMode,
  ProductStatus,
} from '../../generated/prisma/enums';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import type { PublicMediaUrlService } from '../catalog/public-media-url.service';
import { GuideService } from './guide.service';

function createService() {
  const prisma = {
    guideArticle: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn(),
    },
    media: { count: jest.fn().mockResolvedValue(0) },
    guideTopic: { count: jest.fn().mockResolvedValue(0) },
    product: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
    category: { count: jest.fn().mockResolvedValue(0) },
    brand: { count: jest.fn().mockResolvedValue(0) },
    $transaction: jest.fn(),
    $queryRaw: jest.fn().mockResolvedValue([]),
  };
  const mediaUrls = { resolve: jest.fn((key: string) => `https://media.test/${key}`) };
  return {
    service: new GuideService(
      prisma as unknown as PrismaService,
      mediaUrls as unknown as PublicMediaUrlService,
    ),
    prisma,
  };
}

const validDraft = {
  title: 'راهنمای نگهداری نقره',
  slug: 'silver-care',
  format: GuideArticleFormat.CARE_GUIDE,
  status: GuideArticleStatus.DRAFT,
  excerpt: 'راهنمای کاربردی برای مراقبت بهتر از زیورآلات نقره',
  blocks: [
    {
      type: GuideBlockType.RICH_TEXT,
      content: { paragraphs: ['نقره را دور از رطوبت نگهداری کنید.'] },
      sortOrder: 0,
    },
  ],
};

describe('GuideService', () => {
  it('never exposes a draft through the public article endpoint', async () => {
    const { service, prisma } = createService();
    prisma.guideArticle.findFirst.mockResolvedValue(null);

    await expect(service.getPublicArticle('draft-guide')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.guideArticle.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          slug: 'draft-guide',
          status: GuideArticleStatus.PUBLISHED,
          publishedAt: expect.objectContaining({ lte: expect.any(Date) }),
          deletedAt: null,
        }),
      }),
    );
  });

  it('projects only active related products for the public article renderer', async () => {
    const { service, prisma } = createService();
    const baseProduct = {
      id: '00000000-0000-4000-8000-000000000020',
      name: 'انگشتر نقره',
      slug: 'silver-ring',
      shortDescription: null,
      salePriceToman: 1_000_000,
      deletedAt: null,
      variants: [
        {
          salePriceToman: 950_000,
          inventories: [{ onHand: 2, reserved: 0 }],
        },
      ],
      media: [
        {
          isPrimary: true,
          altText: 'انگشتر',
          media: { id: 'media-1', storageKey: 'ring.webp', mimeType: 'image/webp', altText: null },
        },
      ],
    };
    prisma.guideArticle.findFirst.mockResolvedValue({
      id: 'article-1',
      title: 'راهنمای خرید',
      slug: 'buying-guide',
      eyebrow: null,
      excerpt: 'راهنمای انتخاب بهتر',
      format: GuideArticleFormat.BUYING_GUIDE,
      status: GuideArticleStatus.PUBLISHED,
      heroMedia: null,
      heroMobileMedia: null,
      seoTitle: null,
      seoDescription: null,
      seoCanonicalPath: null,
      seoNoIndex: false,
      seoOgMedia: null,
      searchKeywords: [],
      readingTimeMinutes: 5,
      isFeatured: false,
      publishedAt: new Date('2026-10-12T10:00:00.000Z'),
      updatedAt: new Date('2026-10-12T11:00:00.000Z'),
      createdAt: new Date('2026-10-12T09:00:00.000Z'),
      version: 1,
      blocks: [],
      topics: [],
      categories: [],
      brands: [],
      products: [
        { productId: baseProduct.id, product: { ...baseProduct, status: ProductStatus.ACTIVE } },
        {
          productId: '00000000-0000-4000-8000-000000000021',
          product: { ...baseProduct, id: 'archived', status: ProductStatus.ARCHIVED },
        },
      ],
    });

    await expect(service.getPublicArticle('buying-guide')).resolves.toMatchObject({
      relatedProducts: [
        {
          id: baseProduct.id,
          slug: 'silver-ring',
          primaryMedia: { url: 'https://media.test/ring.webp', altText: 'انگشتر' },
        },
      ],
    });
  });

  it('hides manual products that have no sellable inventory without deleting their IDs', async () => {
    const { service, prisma } = createService();
    const product = {
      id: '00000000-0000-4000-8000-000000000030',
      name: 'محصول ناموجود',
      slug: 'unavailable-product',
      shortDescription: null,
      salePriceToman: 1_000_000,
      status: ProductStatus.ACTIVE,
      deletedAt: null,
      variants: [{ salePriceToman: null, inventories: [{ onHand: 1, reserved: 1 }] }],
      media: [],
    };
    prisma.guideArticle.findFirst.mockResolvedValue({
      id: 'article-manual',
      title: 'راهنما',
      slug: 'manual-guide',
      format: GuideArticleFormat.GUIDE,
      status: GuideArticleStatus.PUBLISHED,
      productRecommendationMode: GuideProductRecommendationMode.MANUAL,
      heroMedia: null,
      heroMobileMedia: null,
      cardMedia: null,
      seoOgMedia: null,
      blocks: [],
      topics: [],
      categories: [],
      brands: [],
      products: [{ productId: product.id, product }],
      publishedAt: new Date(),
      updatedAt: new Date(),
      createdAt: new Date(),
    });

    await expect(service.getPublicArticle('manual-guide')).resolves.toMatchObject({
      productIds: [product.id],
      relatedProducts: [],
    });
  });

  it('selects automatic products dynamically and preserves the database ranking', async () => {
    const { service, prisma } = createService();
    const product = {
      id: '00000000-0000-4000-8000-000000000040',
      name: 'انگشتر موجود',
      slug: 'available-ring',
      shortDescription: null,
      salePriceToman: 1_100_000,
      status: ProductStatus.ACTIVE,
      deletedAt: null,
      brandId: '00000000-0000-4000-8000-000000000042',
      createdAt: new Date('2026-10-14T10:00:00.000Z'),
      homepagePopularFeature: { priority: 1 },
      categories: [{ categoryId: '00000000-0000-4000-8000-000000000041' }],
      variants: [{ salePriceToman: 1_000_000, inventories: [{ onHand: 3, reserved: 1 }] }],
      media: [],
    };
    prisma.product.findMany.mockResolvedValue([product]);
    prisma.guideArticle.findFirst.mockResolvedValue({
      id: 'article-auto',
      title: 'راهنمای انگشتر',
      slug: 'automatic-guide',
      format: GuideArticleFormat.BUYING_GUIDE,
      status: GuideArticleStatus.PUBLISHED,
      productRecommendationMode: GuideProductRecommendationMode.AUTOMATIC,
      heroMedia: null,
      heroMobileMedia: null,
      cardMedia: null,
      seoOgMedia: null,
      blocks: [],
      topics: [],
      categories: [{ categoryId: '00000000-0000-4000-8000-000000000041', category: null }],
      brands: [{ brandId: '00000000-0000-4000-8000-000000000042', brand: null }],
      products: [],
      publishedAt: new Date(),
      updatedAt: new Date(),
      createdAt: new Date(),
    });

    await expect(service.getPublicArticle('automatic-guide')).resolves.toMatchObject({
      relatedProducts: [{ id: product.id, salePriceToman: 1_000_000 }],
    });
    expect(prisma.product.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 80,
        where: expect.objectContaining({
          status: ProductStatus.ACTIVE,
          deletedAt: null,
          categories: {
            some: expect.objectContaining({
              categoryId: { in: ['00000000-0000-4000-8000-000000000041'] },
            }),
          },
        }),
      }),
    );
  });

  it('keeps a public article available when automatic recommendations fail', async () => {
    const { service, prisma } = createService();
    const log = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    prisma.product.findMany.mockRejectedValue(new Error('automatic recommendation query failed'));
    prisma.guideArticle.findFirst.mockResolvedValue({
      id: 'article-auto-failure',
      title: 'راهنمای انگشتر',
      slug: 'automatic-guide-failure',
      format: GuideArticleFormat.BUYING_GUIDE,
      status: GuideArticleStatus.PUBLISHED,
      productRecommendationMode: GuideProductRecommendationMode.AUTOMATIC,
      heroMedia: null,
      heroMobileMedia: null,
      cardMedia: null,
      seoOgMedia: null,
      blocks: [],
      topics: [],
      categories: [{ categoryId: '00000000-0000-4000-8000-000000000041', category: null }],
      brands: [],
      products: [],
      publishedAt: new Date(),
      updatedAt: new Date(),
      createdAt: new Date(),
    });

    await expect(service.getPublicArticle('automatic-guide-failure')).resolves.toMatchObject({
      slug: 'automatic-guide-failure',
      relatedProducts: [],
    });
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('article-auto-failure'),
      expect.stringContaining('automatic recommendation query failed'),
    );
    log.mockRestore();
  });

  it('does not resolve any products when recommendations are disabled', async () => {
    const { service, prisma } = createService();
    prisma.guideArticle.findFirst.mockResolvedValue({
      id: 'article-disabled',
      title: 'راهنما',
      slug: 'disabled-guide',
      format: GuideArticleFormat.GUIDE,
      status: GuideArticleStatus.PUBLISHED,
      productRecommendationMode: GuideProductRecommendationMode.DISABLED,
      heroMedia: null,
      heroMobileMedia: null,
      cardMedia: null,
      seoOgMedia: null,
      blocks: [],
      topics: [],
      categories: [],
      brands: [],
      products: [],
      publishedAt: new Date(),
      updatedAt: new Date(),
      createdAt: new Date(),
    });

    await expect(service.getPublicArticle('disabled-guide')).resolves.toMatchObject({
      relatedProducts: [],
    });
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('ranks related articles by shared commerce references before shared topics', async () => {
    const { service, prisma } = createService();
    const source = {
      id: 'article-source',
      title: 'راهنمای انتخاب انگشتر',
      slug: 'ring-guide',
      eyebrow: null,
      excerpt: 'راهنمای انتخاب',
      format: GuideArticleFormat.BUYING_GUIDE,
      status: GuideArticleStatus.PUBLISHED,
      heroMedia: null,
      heroMobileMedia: null,
      seoTitle: null,
      seoDescription: null,
      seoCanonicalPath: null,
      seoNoIndex: false,
      seoOgMedia: null,
      searchKeywords: [],
      readingTimeMinutes: 4,
      isFeatured: false,
      publishedAt: new Date('2026-10-12T10:00:00.000Z'),
      updatedAt: new Date('2026-10-12T11:00:00.000Z'),
      createdAt: new Date('2026-10-12T09:00:00.000Z'),
      version: 1,
      blocks: [],
      topics: [{ topicId: 'topic-silver', topic: { id: 'topic-silver' } }],
      products: [],
      categories: [{ categoryId: 'category-ring', category: null }],
      brands: [],
    };
    const candidate = (id: string, categoryId: string, topicId: string) => ({
      ...source,
      id,
      title: id,
      slug: id,
      heroMobileMedia: undefined,
      searchKeywords: undefined,
      createdAt: undefined,
      categories: [{ categoryId }],
      topics: [{ topicId, topic: { id: topicId, name: topicId, slug: topicId, coverMedia: null } }],
    });
    prisma.guideArticle.findFirst.mockResolvedValue(source);
    prisma.guideArticle.findMany.mockResolvedValue([
      candidate('topic-match', 'other-category', 'topic-silver'),
      candidate('category-match', 'category-ring', 'other-topic'),
    ]);

    await expect(service.getPublicArticle('ring-guide')).resolves.toMatchObject({
      relatedArticles: [{ slug: 'category-match' }, { slug: 'topic-match' }],
    });
  });

  it('returns indexable guides linked to a catalog context', async () => {
    const { service, prisma } = createService();
    prisma.guideArticle.findMany.mockResolvedValue([]);

    await service.listPublicRelatedArticles({
      product: 'silver-ring',
      categories: ['rings'],
      brand: 'sample-brand',
      limit: 4,
    });

    expect(prisma.guideArticle.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: GuideArticleStatus.PUBLISHED,
          seoNoIndex: false,
          OR: expect.arrayContaining([
            expect.objectContaining({ products: expect.any(Object) }),
            expect.objectContaining({ categories: expect.any(Object) }),
            expect.objectContaining({ brands: expect.any(Object) }),
          ]),
        }),
        take: 4,
      }),
    );
  });

  it('rejects raw HTML in structured block content', async () => {
    const { service } = createService();
    await expect(
      service.createArticle(
        {
          ...validDraft,
          blocks: [
            {
              type: GuideBlockType.RICH_TEXT,
              content: { body: '<script>alert(1)</script>' },
              sortOrder: 0,
            },
          ],
        },
        '00000000-0000-4000-8000-000000000001',
      ),
    ).rejects.toThrow('Raw HTML is not accepted');
  });

  it('requires an excerpt and at least one block before publication', async () => {
    const { service } = createService();
    await expect(
      service.createArticle(
        {
          title: validDraft.title,
          slug: validDraft.slug,
          status: GuideArticleStatus.PUBLISHED,
          blocks: [],
        },
        '00000000-0000-4000-8000-000000000001',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects duplicate block positions before writing', async () => {
    const { service, prisma } = createService();
    await expect(
      service.createArticle(
        {
          ...validDraft,
          blocks: [validDraft.blocks[0], { ...validDraft.blocks[0] }],
        },
        '00000000-0000-4000-8000-000000000001',
      ),
    ).rejects.toThrow('sortOrder values must be unique');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
