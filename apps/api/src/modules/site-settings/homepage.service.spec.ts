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
const mobileMedia = {
  ...media,
  storageKey: 'homepage/hero-mobile.webp',
  width: 1086,
  height: 1448,
};

describe('HomepageService', () => {
  const prisma = {
    homepageHeroSlide: { findMany: jest.fn() },
    homepageFeaturedCategory: { findMany: jest.fn() },
    homepagePopularProduct: { findMany: jest.fn() },
    homepageFeaturedBrand: { findMany: jest.fn() },
    homepageManufacturerCountry: { findMany: jest.fn() },
    siteSettings: { findUnique: jest.fn() },
    media: { findMany: jest.fn() },
    category: { findMany: jest.fn() },
    product: { findMany: jest.fn() },
    brand: { findMany: jest.fn() },
    country: { findMany: jest.fn() },
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

  it('assembles ordered public merchandising with configured brands', async () => {
    prisma.homepageHeroSlide.findMany.mockResolvedValue([
      {
        id: 'hero-1',
        placement: HomepageHeroPlacement.PRIMARY,
        title: 'کالکشن تازه',
        subtitle: null,
        actionLabel: 'مشاهده',
        actionHref: '/products',
        contentColor: '#C7A45A',
        media,
        mobileMedia,
      },
      {
        id: 'hero-2',
        placement: HomepageHeroPlacement.SECONDARY,
        title: null,
        subtitle: null,
        actionLabel: null,
        actionHref: null,
        contentColor: '#FFFFFF',
        media,
        mobileMedia,
      },
    ]);
    prisma.homepageFeaturedCategory.findMany.mockResolvedValue([
      { categoryId: 'category-1', priority: 1 },
    ]);
    prisma.homepagePopularProduct.findMany.mockResolvedValue([
      { product: { slug: 'popular-ring' } },
    ]);
    prisma.homepageFeaturedBrand.findMany.mockResolvedValue([
      { brandId: 'brand-3' },
      { brandId: 'brand-1' },
      { brandId: 'brand-4' },
      { brandId: 'brand-2' },
    ]);
    prisma.homepageManufacturerCountry.findMany.mockResolvedValue([
      {
        priority: 1,
        country: {
          id: 'country-2',
          name: 'ایتالیا',
          slug: 'italy',
          isoCode: 'IT',
          image: { ...media, storageKey: 'countries/italy.webp' },
        },
      },
      {
        priority: 2,
        country: {
          id: 'country-1',
          name: 'ایران',
          slug: 'iran',
          isoCode: 'IR',
          image: null,
        },
      },
      {
        priority: 3,
        country: {
          id: 'country-3',
          name: 'ترکیه',
          slug: 'turkey',
          isoCode: 'TR',
          image: null,
        },
      },
      {
        priority: 4,
        country: {
          id: 'country-4',
          name: 'تایلند',
          slug: 'thailand',
          isoCode: 'TH',
          image: null,
        },
      },
    ]);
    prisma.siteSettings.findUnique.mockResolvedValue({ manufacturerCountriesEnabled: true });
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
    expect(result.primaryHeroSlides[0]?.mobileMedia?.url).toBe(
      'https://media.hamidian.test/homepage/hero-mobile.webp',
    );
    expect(result.primaryHeroSlides[0]?.contentColor).toBe('#C7A45A');
    expect(result.secondaryHero).not.toBeNull();
    expect(result.newProducts).toEqual([{ id: 'new-1' }]);
    expect(result.featuredCategories).toEqual([{ id: 'category-1', name: 'انگشتر', priority: 1 }]);
    expect(result.popularProducts).toEqual([
      expect.objectContaining({ id: 'popular-1', slug: 'popular-ring' }),
    ]);
    expect(result.popularProducts[0]).not.toHaveProperty('description');
    expect(result.featuredBrands.map(({ id }) => id)).toEqual([
      'brand-3',
      'brand-1',
      'brand-4',
      'brand-2',
    ]);
    expect(result.manufacturerCountries.map(({ slug }) => slug)).toEqual([
      'italy',
      'iran',
      'turkey',
      'thailand',
    ]);
  });

  it('rejects incomplete or unsafe hero actions before writing', async () => {
    await expect(
      service.updateHomepage(
        {
          primaryHeroSlides: [
            {
              mediaId: '10000000-0000-4000-8000-000000000001',
              mobileMediaId: '10000000-0000-4000-8000-000000000002',
              actionLabel: 'مشاهده',
              actionHref: 'javascript:alert(1)',
              contentColor: '#FFFFFF',
            },
          ],
          categoryIds: [],
          popularProductIds: [],
          featuredBrandIds: [],
          manufacturerCountriesEnabled: false,
          manufacturerCountryIds: [],
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
        mobileMediaId: 'media-mobile-1',
        title: 'کالکشن تازه',
        subtitle: null,
        actionLabel: null,
        actionHref: null,
        contentColor: '#C7A45A',
        sortOrder: 1,
        isActive: true,
        media: { id: 'media-1', ...media },
        mobileMedia: { id: 'media-mobile-1', ...mobileMedia },
      },
    ]);
    prisma.homepageFeaturedCategory.findMany.mockResolvedValue([]);
    prisma.homepagePopularProduct.findMany.mockResolvedValue([]);
    prisma.homepageFeaturedBrand.findMany.mockResolvedValue([{ brandId: 'brand-2', priority: 1 }]);
    prisma.homepageManufacturerCountry.findMany.mockResolvedValue([]);
    prisma.siteSettings.findUnique.mockResolvedValue(null);

    const result = await service.getAdminHomepage();

    expect(result.primaryHeroSlides[0]?.media).toEqual({
      id: 'media-1',
      url: 'https://media.hamidian.test/homepage/hero.webp',
      mimeType: 'image/webp',
      altText: 'تصویر هیرو',
    });
    expect(result.primaryHeroSlides[0]?.mobileMedia).toEqual({
      id: 'media-mobile-1',
      url: 'https://media.hamidian.test/homepage/hero-mobile.webp',
      mimeType: 'image/webp',
      altText: 'تصویر هیرو',
    });
    expect(result.primaryHeroSlides[0]?.contentColor).toBe('#C7A45A');
    expect(result.featuredBrands).toEqual([{ id: 'brand-2', priority: 1 }]);
  });

  it('replaces homepage configuration transactionally in the requested order', async () => {
    prisma.media.findMany.mockResolvedValue([
      { id: '10000000-0000-4000-8000-000000000001' },
      { id: '10000000-0000-4000-8000-000000000002' },
    ]);
    prisma.category.findMany.mockResolvedValue([
      { id: '30000000-0000-4000-8000-000000000001' },
      { id: '30000000-0000-4000-8000-000000000002' },
    ]);
    prisma.product.findMany.mockResolvedValue([{ id: '40000000-0000-4000-8000-000000000001' }]);
    prisma.brand.findMany.mockResolvedValue([
      { id: '60000000-0000-4000-8000-000000000001' },
      { id: '60000000-0000-4000-8000-000000000002' },
    ]);
    prisma.country.findMany.mockResolvedValue([
      { id: '50000000-0000-4000-8000-000000000001' },
      { id: '50000000-0000-4000-8000-000000000002' },
      { id: '50000000-0000-4000-8000-000000000003' },
      { id: '50000000-0000-4000-8000-000000000004' },
    ]);
    const transaction = {
      homepageHeroSlide: { deleteMany: jest.fn(), createMany: jest.fn() },
      homepageFeaturedCategory: { deleteMany: jest.fn(), createMany: jest.fn() },
      homepagePopularProduct: { deleteMany: jest.fn(), createMany: jest.fn() },
      homepageFeaturedBrand: { deleteMany: jest.fn(), createMany: jest.fn() },
      homepageManufacturerCountry: { deleteMany: jest.fn(), createMany: jest.fn() },
      siteSettings: { upsert: jest.fn() },
    };
    prisma.$transaction.mockImplementation(
      async (callback: (client: typeof transaction) => Promise<void>) => callback(transaction),
    );
    prisma.homepageHeroSlide.findMany.mockResolvedValue([]);
    prisma.homepageFeaturedCategory.findMany.mockResolvedValue([]);
    prisma.homepagePopularProduct.findMany.mockResolvedValue([]);
    prisma.homepageFeaturedBrand.findMany.mockResolvedValue([]);
    prisma.homepageManufacturerCountry.findMany.mockResolvedValue([]);
    prisma.siteSettings.findUnique.mockResolvedValue({
      manufacturerCountriesEnabled: true,
      updatedAt: new Date('2026-09-07T09:00:00.000Z'),
    });

    await service.updateHomepage(
      {
        primaryHeroSlides: [
          {
            mediaId: '10000000-0000-4000-8000-000000000001',
            mobileMediaId: '10000000-0000-4000-8000-000000000002',
            title: '  عنوان  ',
            actionLabel: 'خرید',
            actionHref: '/products',
            contentColor: '#c7a45a',
          },
        ],
        categoryIds: [
          '30000000-0000-4000-8000-000000000001',
          '30000000-0000-4000-8000-000000000002',
        ],
        popularProductIds: ['40000000-0000-4000-8000-000000000001'],
        featuredBrandIds: [
          '60000000-0000-4000-8000-000000000002',
          '60000000-0000-4000-8000-000000000001',
        ],
        manufacturerCountriesEnabled: true,
        manufacturerCountryIds: [
          '50000000-0000-4000-8000-000000000004',
          '50000000-0000-4000-8000-000000000002',
          '50000000-0000-4000-8000-000000000001',
          '50000000-0000-4000-8000-000000000003',
        ],
      },
      '20000000-0000-4000-8000-000000000001',
    );

    expect(transaction.homepageHeroSlide.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          placement: HomepageHeroPlacement.PRIMARY,
          sortOrder: 1,
          title: 'عنوان',
          contentColor: '#C7A45A',
        }),
      ],
    });
    expect(transaction.homepageFeaturedCategory.createMany).toHaveBeenCalledWith({
      data: [
        { categoryId: '30000000-0000-4000-8000-000000000001', priority: 1 },
        { categoryId: '30000000-0000-4000-8000-000000000002', priority: 2 },
      ],
    });
    expect(transaction.homepageFeaturedBrand.createMany).toHaveBeenCalledWith({
      data: [
        { brandId: '60000000-0000-4000-8000-000000000002', priority: 1 },
        { brandId: '60000000-0000-4000-8000-000000000001', priority: 2 },
      ],
    });
    expect(transaction.homepageManufacturerCountry.createMany).toHaveBeenCalledWith({
      data: [
        { countryId: '50000000-0000-4000-8000-000000000004', priority: 1 },
        { countryId: '50000000-0000-4000-8000-000000000002', priority: 2 },
        { countryId: '50000000-0000-4000-8000-000000000001', priority: 3 },
        { countryId: '50000000-0000-4000-8000-000000000003', priority: 4 },
      ],
    });
    expect(transaction.siteSettings.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: {
          manufacturerCountriesEnabled: true,
          updatedByUserId: '20000000-0000-4000-8000-000000000001',
        },
      }),
    );
  });

  it('rejects an enabled manufacturer section with fewer than four countries', async () => {
    await expect(
      service.updateHomepage(
        {
          primaryHeroSlides: [],
          secondaryHero: null,
          categoryIds: [],
          popularProductIds: [],
          featuredBrandIds: [],
          manufacturerCountriesEnabled: true,
          manufacturerCountryIds: [
            '50000000-0000-4000-8000-000000000001',
            '50000000-0000-4000-8000-000000000002',
            '50000000-0000-4000-8000-000000000003',
          ],
        },
        '20000000-0000-4000-8000-000000000001',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('returns no manufacturer countries while the section is disabled', async () => {
    prisma.homepageHeroSlide.findMany.mockResolvedValue([]);
    prisma.homepageFeaturedCategory.findMany.mockResolvedValue([]);
    prisma.homepagePopularProduct.findMany.mockResolvedValue([]);
    prisma.homepageFeaturedBrand.findMany.mockResolvedValue([]);
    prisma.homepageManufacturerCountry.findMany.mockResolvedValue([
      {
        priority: 1,
        country: { id: 'country-1', name: 'ایران', slug: 'iran', isoCode: 'IR', image: null },
      },
    ]);
    prisma.siteSettings.findUnique.mockResolvedValue({ manufacturerCountriesEnabled: false });
    catalogService.listPublicProducts.mockResolvedValue({ items: [] });
    catalogService.listPublicBrands.mockResolvedValue([]);
    catalogService.listPublicCategories.mockResolvedValue([]);

    const result = await service.getPublicHomepage();

    expect(result.manufacturerCountriesEnabled).toBe(false);
    expect(result.manufacturerCountries).toEqual([]);
  });

  it('rejects more than eight manufacturer countries even while disabled', async () => {
    await expect(
      service.updateHomepage(
        {
          primaryHeroSlides: [],
          secondaryHero: null,
          categoryIds: [],
          popularProductIds: [],
          featuredBrandIds: [],
          manufacturerCountriesEnabled: false,
          manufacturerCountryIds: Array.from(
            { length: 9 },
            (_, index) => `50000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
          ),
        },
        '20000000-0000-4000-8000-000000000001',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
