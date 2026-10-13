import { ProductStatus, StorefrontContentPageKey } from '../../generated/prisma/enums';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import type { PublicMediaUrlService } from '../catalog/public-media-url.service';
import { SeoSitemapService } from './seo-sitemap.service';

describe('SeoSitemapService', () => {
  const prisma = {
    product: { findMany: jest.fn() },
    category: { findMany: jest.fn() },
    brand: { findMany: jest.fn() },
    storefrontContentPage: { findMany: jest.fn() },
  };
  const publicMediaUrl = {
    resolve: jest.fn((storageKey: string) => `https://media.hamidian.shop/${storageKey}`),
  };
  let service: SeoSitemapService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SeoSitemapService(
      prisma as unknown as PrismaService,
      publicMediaUrl as unknown as PublicMediaUrlService,
    );
  });

  it('loads one lightweight snapshot and removes inactive collection relations', async () => {
    prisma.product.findMany.mockResolvedValue([
      {
        id: 'product-1',
        slug: 'silver-ring',
        seoCanonicalPath: null,
        seoNoIndex: false,
        updatedAt: new Date('2026-10-01T10:00:00.000Z'),
        brandId: 'brand-active',
        categories: [{ categoryId: 'category-active' }, { categoryId: 'category-inactive' }],
        media: [{ media: { storageKey: 'products/ring.webp', deletedAt: null } }],
      },
      {
        id: 'product-2',
        slug: 'orphan-product',
        seoCanonicalPath: '/products/orphan-canonical',
        seoNoIndex: true,
        updatedAt: new Date('2026-10-02T10:00:00.000Z'),
        brandId: 'brand-inactive',
        categories: [],
        media: [],
      },
    ]);
    prisma.category.findMany.mockResolvedValue([
      {
        id: 'category-active',
        slug: 'rings',
        parentId: null,
        seoCanonicalPath: null,
        seoNoIndex: false,
        updatedAt: new Date('2026-09-30T10:00:00.000Z'),
        image: { storageKey: 'categories/rings.webp', deletedAt: null },
        seoOgMedia: { storageKey: 'categories/rings-og.webp', deletedAt: null },
      },
    ]);
    prisma.brand.findMany.mockResolvedValue([
      {
        id: 'brand-active',
        slug: 'hamidian',
        seoCanonicalPath: null,
        seoNoIndex: false,
        updatedAt: new Date('2026-09-29T10:00:00.000Z'),
        image: null,
        heroImage: { storageKey: 'brands/hero.webp', deletedAt: null },
        seoOgMedia: null,
      },
    ]);
    prisma.storefrontContentPage.findMany.mockResolvedValue([
      {
        key: StorefrontContentPageKey.ABOUT,
        seoCanonicalPath: '/about',
        seoNoIndex: false,
        updatedAt: new Date('2026-09-28T10:00:00.000Z'),
        heroMedia: { storageKey: 'pages/about.webp', deletedAt: null },
        seoOgMedia: null,
      },
    ]);

    await expect(service.getPublicSitemap()).resolves.toEqual({
      products: [
        {
          id: 'product-1',
          slug: 'silver-ring',
          seoCanonicalPath: null,
          seoNoIndex: false,
          updatedAt: '2026-10-01T10:00:00.000Z',
          brandId: 'brand-active',
          categoryIds: ['category-active'],
          imageUrl: 'https://media.hamidian.shop/products/ring.webp',
        },
        {
          id: 'product-2',
          slug: 'orphan-product',
          seoCanonicalPath: '/products/orphan-canonical',
          seoNoIndex: true,
          updatedAt: '2026-10-02T10:00:00.000Z',
          brandId: null,
          categoryIds: [],
          imageUrl: null,
        },
      ],
      categories: [
        {
          id: 'category-active',
          slug: 'rings',
          parentId: null,
          seoCanonicalPath: null,
          seoNoIndex: false,
          updatedAt: '2026-09-30T10:00:00.000Z',
          imageUrl: 'https://media.hamidian.shop/categories/rings-og.webp',
        },
      ],
      brands: [
        {
          id: 'brand-active',
          slug: 'hamidian',
          seoCanonicalPath: null,
          seoNoIndex: false,
          updatedAt: '2026-09-29T10:00:00.000Z',
          imageUrl: 'https://media.hamidian.shop/brands/hero.webp',
        },
      ],
      contentPages: [
        {
          key: StorefrontContentPageKey.ABOUT,
          seoCanonicalPath: '/about',
          seoNoIndex: false,
          updatedAt: '2026-09-28T10:00:00.000Z',
          imageUrl: 'https://media.hamidian.shop/pages/about.webp',
        },
      ],
    });

    expect(prisma.product.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.category.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.brand.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.storefrontContentPage.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: ProductStatus.ACTIVE, deletedAt: null },
        select: expect.not.objectContaining({ variants: expect.anything() }),
      }),
    );
    expect(prisma.product.findMany.mock.calls[0]?.[0]?.select).not.toHaveProperty('inventories');
  });
});
