import { BadRequestException } from '@nestjs/common';

import { HomepageHeroPlacement } from '../../generated/prisma/enums';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import type { CatalogService } from '../catalog/catalog.service';
import type { PublicMediaUrlService } from '../catalog/public-media-url.service';
import { HomepageService } from './homepage.service';

const media = {
  storageKey: 'homepage/hero.webp',
  mimeType: 'image/webp',
  altText: 'تصویر هیرو',
  width: 1920,
  height: 1080,
  deletedAt: null,
};

describe('HomepageService', () => {
  const prisma = {
    homepageHeroSlide: { findMany: jest.fn() },
    homepageFeaturedCategory: { findMany: jest.fn() },
    homepagePopularProduct: { findMany: jest.fn() },
    siteSettings: { findUnique: jest.fn() },
    media: { findMany: jest.fn() },
    category: { findMany: jest.fn() },
    product: { findMany: jest.fn() },
    $transaction: jest.fn(),
  };
  const catalogService = {
    listPublicProducts: jest.fn(),
    listPublicBrands: jest.fn(),
    listPublicCategories: jest.fn(),
    getPublicProduct: jest.fn(),
  };
  const publicMediaUrlService = {
    resolve: jest.fn((storageKey: string) => `https://media.hamidian.test/${storageKey}`),
  };
  let service: HomepageService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new HomepageService(
      prisma as unknown as PrismaService,
      catalogService as unknown as CatalogService,
      publicMediaUrlService as unknown as PublicMediaUrlService,
    );
  });

  it('assembles ordered public merchandising and limits brands to four', async () => {
    prisma.homepageHeroSlide.findMany.mockResolvedValue([
      {
        id: 'hero-1',
        placement: HomepageHeroPlacement.PRIMARY,
        title: 'کالکشن تازه',
        subtitle: null,
        actionLabel: 'مشاهده',
        actionHref: '/products',
        media,
      },
      {
        id: 'hero-2',
        placement: HomepageHeroPlacement.SECONDARY,
        title: null,
        subtitle: null,
        actionLabel: null,
        actionHref: null,
        media,
      },
    ]);
    prisma.homepageFeaturedCategory.findMany.mockResolvedValue([
      { categoryId: 'category-1', priority: 1 },
    ]);
    prisma.homepagePopularProduct.findMany.mockResolvedValue([
      { product: { slug: 'popular-ring' } },
    ]);
    catalogService.listPublicProducts.mockResolvedValue({ items: [{ id: 'new-1' }] });
    catalogService.listPublicBrands.mockResolvedValue(
      Array.from({ length: 9 }, (_, index) => ({ id: `brand-${index + 1}` })),
    );
    catalogService.listPublicCategories.mockResolvedValue([{ id: 'category-1', name: 'انگشتر' }]);
    catalogService.getPublicProduct.mockResolvedValue({
      id: 'popular-1',
      name: 'انگشتر محبوب',
      slug: 'popular-ring',
      shortDescription: null,
      salePriceToman: 1_000_000,
      compareAtPriceToman: null,
      sizeMode: 'NONE',
      brand: null,
      categories: [],
      primaryMedia: null,
      availableQuantity: 1,
      isAvailable: true,
      description: 'internal detail',
      country: null,
      variants: [],
      media: [],
    });

    const result = await service.getPublicHomepage();

    expect(result.primaryHeroSlides).toHaveLength(1);
    expect(result.primaryHeroSlides[0]?.media.url).toBe(
      'https://media.hamidian.test/homepage/hero.webp',
    );
    expect(result.secondaryHero).not.toBeNull();
    expect(result.newProducts).toEqual([{ id: 'new-1' }]);
    expect(result.featuredCategories).toEqual([{ id: 'category-1', name: 'انگشتر', priority: 1 }]);
    expect(result.popularProducts).toEqual([
      expect.objectContaining({ id: 'popular-1', slug: 'popular-ring' }),
    ]);
    expect(result.popularProducts[0]).not.toHaveProperty('description');
    expect(result.featuredBrands).toHaveLength(4);
  });

  it('rejects incomplete or unsafe hero actions before writing', async () => {
    await expect(
      service.updateHomepage(
        {
          primaryHeroSlides: [
            {
              mediaId: '10000000-0000-4000-8000-000000000001',
              actionLabel: 'مشاهده',
              actionHref: 'javascript:alert(1)',
            },
          ],
          categoryIds: [],
          popularProductIds: [],
        },
        '20000000-0000-4000-8000-000000000001',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('includes an admin preview for configured hero media', async () => {
    prisma.homepageHeroSlide.findMany.mockResolvedValue([
      {
        id: 'hero-1',
        placement: HomepageHeroPlacement.PRIMARY,
        mediaId: 'media-1',
        title: 'کالکشن تازه',
        subtitle: null,
        actionLabel: null,
        actionHref: null,
        sortOrder: 1,
        isActive: true,
        media: { id: 'media-1', ...media },
      },
    ]);
    prisma.homepageFeaturedCategory.findMany.mockResolvedValue([]);
    prisma.homepagePopularProduct.findMany.mockResolvedValue([]);
    prisma.siteSettings.findUnique.mockResolvedValue(null);

    const result = await service.getAdminHomepage();

    expect(result.primaryHeroSlides[0]?.media).toEqual({
      id: 'media-1',
      url: 'https://media.hamidian.test/homepage/hero.webp',
      mimeType: 'image/webp',
      altText: 'تصویر هیرو',
    });
  });

  it('replaces homepage configuration transactionally in the requested order', async () => {
    prisma.media.findMany.mockResolvedValue([{ id: '10000000-0000-4000-8000-000000000001' }]);
    prisma.category.findMany.mockResolvedValue([
      { id: '30000000-0000-4000-8000-000000000001' },
      { id: '30000000-0000-4000-8000-000000000002' },
    ]);
    prisma.product.findMany.mockResolvedValue([{ id: '40000000-0000-4000-8000-000000000001' }]);
    const transaction = {
      homepageHeroSlide: { deleteMany: jest.fn(), createMany: jest.fn() },
      homepageFeaturedCategory: { deleteMany: jest.fn(), createMany: jest.fn() },
      homepagePopularProduct: { deleteMany: jest.fn(), createMany: jest.fn() },
      siteSettings: { upsert: jest.fn() },
    };
    prisma.$transaction.mockImplementation(
      async (callback: (client: typeof transaction) => Promise<void>) => callback(transaction),
    );
    prisma.homepageHeroSlide.findMany.mockResolvedValue([]);
    prisma.homepageFeaturedCategory.findMany.mockResolvedValue([]);
    prisma.homepagePopularProduct.findMany.mockResolvedValue([]);
    prisma.siteSettings.findUnique.mockResolvedValue({
      updatedAt: new Date('2026-09-07T09:00:00.000Z'),
    });

    await service.updateHomepage(
      {
        primaryHeroSlides: [
          {
            mediaId: '10000000-0000-4000-8000-000000000001',
            title: '  عنوان  ',
            actionLabel: 'خرید',
            actionHref: '/products',
          },
        ],
        categoryIds: [
          '30000000-0000-4000-8000-000000000001',
          '30000000-0000-4000-8000-000000000002',
        ],
        popularProductIds: ['40000000-0000-4000-8000-000000000001'],
      },
      '20000000-0000-4000-8000-000000000001',
    );

    expect(transaction.homepageHeroSlide.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          placement: HomepageHeroPlacement.PRIMARY,
          sortOrder: 1,
          title: 'عنوان',
        }),
      ],
    });
    expect(transaction.homepageFeaturedCategory.createMany).toHaveBeenCalledWith({
      data: [
        { categoryId: '30000000-0000-4000-8000-000000000001', priority: 1 },
        { categoryId: '30000000-0000-4000-8000-000000000002', priority: 2 },
      ],
    });
    expect(transaction.siteSettings.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { updatedByUserId: '20000000-0000-4000-8000-000000000001' },
      }),
    );
  });
});
