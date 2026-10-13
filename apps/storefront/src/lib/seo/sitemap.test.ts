import { describe, expect, it } from 'vitest';

import type { PublicGuideArticleSummary } from '@/lib/guide/public-guide';
import type { PublicSeoSitemap } from '@/lib/seo/public-sitemap-source';
import { buildStorefrontSitemap } from '@/lib/seo/sitemap';

const origin = new URL('https://silver.example');

function sitemapSources(): PublicSeoSitemap {
  return {
    products: [
      {
        id: 'product-1',
        slug: 'ring',
        seoCanonicalPath: '/products/ring-canonical',
        seoNoIndex: false,
        updatedAt: '2026-09-25T10:00:00.000Z',
        brandId: 'brand-1',
        categoryIds: ['category-1'],
        imageUrl: '/media/ring.webp',
      },
      {
        id: 'product-2',
        slug: 'hidden',
        seoCanonicalPath: null,
        seoNoIndex: true,
        updatedAt: '2026-09-22T10:00:00.000Z',
        brandId: null,
        categoryIds: [],
        imageUrl: null,
      },
    ],
    categories: [
      {
        id: 'category-parent',
        slug: 'jewelry',
        parentId: null,
        seoCanonicalPath: null,
        seoNoIndex: false,
        updatedAt: '2026-09-20T08:00:00.000Z',
        imageUrl: null,
      },
      {
        id: 'category-1',
        slug: 'rings',
        parentId: 'category-parent',
        seoCanonicalPath: null,
        seoNoIndex: false,
        updatedAt: '2026-09-24T08:00:00.000Z',
        imageUrl: null,
      },
      {
        id: 'category-empty',
        slug: 'empty-category',
        parentId: null,
        seoCanonicalPath: null,
        seoNoIndex: false,
        updatedAt: '2026-09-24T08:00:00.000Z',
        imageUrl: null,
      },
    ],
    brands: [
      {
        id: 'brand-1',
        slug: 'visible-brand',
        seoCanonicalPath: null,
        seoNoIndex: false,
        updatedAt: '2026-09-21T08:00:00.000Z',
        imageUrl: null,
      },
      {
        id: 'brand-hidden',
        slug: 'hidden-brand',
        seoCanonicalPath: null,
        seoNoIndex: true,
        updatedAt: '2026-09-21T08:00:00.000Z',
        imageUrl: null,
      },
    ],
    contentPages: [
      {
        key: 'ABOUT',
        seoCanonicalPath: '/story',
        seoNoIndex: false,
        updatedAt: '2026-09-23T09:30:00.000Z',
        imageUrl: null,
      },
    ],
  };
}

describe('buildStorefrontSitemap', () => {
  it('includes indexable knowledge articles, their canonical and preferred image', () => {
    const guideArticles = [
      {
        id: 'guide-1',
        title: 'مراقبت از نقره',
        slug: 'silver-care',
        eyebrow: null,
        excerpt: 'راهنمای نگهداری نقره',
        format: 'CARE_GUIDE',
        heroMedia: {
          id: 'media-1',
          url: '/media/guide.webp',
          mimeType: 'image/webp',
          altText: null,
        },
        seoCanonicalPath: '/guide/care-for-silver',
        seoNoIndex: false,
        seoOgMedia: null,
        readingTimeMinutes: 4,
        isFeatured: true,
        publishedAt: '2026-10-11T10:00:00.000Z',
        topics: [],
        updatedAt: '2026-10-12T10:00:00.000Z',
      },
      {
        id: 'guide-2',
        title: 'مطلب مخفی',
        slug: 'hidden-guide',
        eyebrow: null,
        excerpt: null,
        format: 'GUIDE',
        heroMedia: null,
        seoCanonicalPath: null,
        seoNoIndex: true,
        seoOgMedia: null,
        readingTimeMinutes: null,
        isFeatured: false,
        publishedAt: null,
        topics: [],
        updatedAt: '2026-10-12T10:00:00.000Z',
      },
    ] satisfies PublicGuideArticleSummary[];

    const sitemap = buildStorefrontSitemap({ ...sitemapSources(), guideArticles }, origin);

    expect(sitemap).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          url: 'https://silver.example/guide',
          lastModified: new Date('2026-10-12T10:00:00.000Z'),
        }),
        expect.objectContaining({
          url: 'https://silver.example/guide/care-for-silver',
          images: ['https://silver.example/media/guide.webp'],
        }),
      ]),
    );
    expect(sitemap.some(({ url }) => url.includes('hidden-guide'))).toBe(false);
  });

  it('uses canonicals, excludes no-index records and includes product images', () => {
    const sitemap = buildStorefrontSitemap(sitemapSources(), origin);

    expect(sitemap).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ url: 'https://silver.example/' }),
        expect.objectContaining({
          url: 'https://silver.example/story',
          lastModified: new Date('2026-09-23T09:30:00.000Z'),
        }),
        expect.objectContaining({
          url: 'https://silver.example/products',
          lastModified: new Date('2026-09-25T10:00:00.000Z'),
        }),
        expect.objectContaining({
          url: 'https://silver.example/categories',
          lastModified: new Date('2026-09-25T10:00:00.000Z'),
        }),
        expect.objectContaining({
          url: 'https://silver.example/categories/jewelry',
          lastModified: new Date('2026-09-25T10:00:00.000Z'),
        }),
        expect.objectContaining({
          url: 'https://silver.example/categories/rings',
          lastModified: new Date('2026-09-25T10:00:00.000Z'),
        }),
        expect.objectContaining({
          url: 'https://silver.example/brands/visible-brand',
          lastModified: new Date('2026-09-25T10:00:00.000Z'),
        }),
        expect.objectContaining({
          url: 'https://silver.example/products/ring-canonical',
          lastModified: new Date('2026-09-25T10:00:00.000Z'),
          images: ['https://silver.example/media/ring.webp'],
        }),
      ]),
    );
    expect(sitemap.some((entry) => entry.url.includes('hidden'))).toBe(false);
    expect(sitemap.some((entry) => entry.url.includes('empty-category'))).toBe(false);
  });

  it('uses the same safe canonical fallback as page metadata', () => {
    const sources = sitemapSources();
    sources.products[0]!.seoCanonicalPath = 'https://evil.example/product';
    sources.categories[1]!.seoCanonicalPath = '/products/wrong-family';
    sources.brands[0]!.seoCanonicalPath = '/account/orders';

    const locations = buildStorefrontSitemap(sources, origin).map(({ url }) => url);

    expect(locations).toEqual(
      expect.arrayContaining([
        'https://silver.example/products/ring',
        'https://silver.example/categories/rings',
        'https://silver.example/brands/visible-brand',
      ]),
    );
    expect(locations.some((url) => url.startsWith('https://evil.example'))).toBe(false);
  });

  it('keeps collections populated by displayable no-index products', () => {
    const sources = sitemapSources();
    sources.products[0]!.seoNoIndex = true;

    const locations = buildStorefrontSitemap(sources, origin).map(({ url }) => url);

    expect(locations).toContain('https://silver.example/categories/rings');
    expect(locations).toContain('https://silver.example/brands/visible-brand');
    expect(locations).not.toContain('https://silver.example/products/ring-canonical');
  });

  it('ignores invalid dates instead of emitting a fabricated lastmod', () => {
    const sources = sitemapSources();
    sources.products[0]!.updatedAt = 'not-a-date';
    sources.categories[1]!.updatedAt = 'also-invalid';

    const entry = buildStorefrontSitemap(sources, origin).find(
      ({ url }) => url === 'https://silver.example/categories/rings',
    );

    expect(entry).toEqual({ url: 'https://silver.example/categories/rings' });
  });

  it('builds a 10,000-product sitemap from one compact snapshot', () => {
    const products = Array.from({ length: 10_000 }, (_, index) => ({
      id: `product-${index}`,
      slug: `product-${index}`,
      seoCanonicalPath: null,
      seoNoIndex: false,
      updatedAt: '2026-10-01T10:00:00.000Z',
      brandId: null,
      categoryIds: [],
      imageUrl: null,
    }));

    const sitemap = buildStorefrontSitemap(
      { products, categories: [], brands: [], contentPages: [] },
      origin,
    );

    expect(sitemap.filter(({ url }) => url.includes('/products/'))).toHaveLength(10_000);
    expect(new Set(sitemap.map(({ url }) => url))).toHaveProperty('size', sitemap.length);
  });

  it('omits empty catalog hubs from the sitemap', () => {
    const sitemap = buildStorefrontSitemap(
      { products: [], categories: [], brands: [], contentPages: [] },
      origin,
    );

    const locations = sitemap.map(({ url }) => url);
    expect(locations).toEqual(
      expect.arrayContaining([
        'https://silver.example/',
        'https://silver.example/about',
        'https://silver.example/contact',
      ]),
    );
    expect(locations).not.toContain('https://silver.example/products');
    expect(locations).not.toContain('https://silver.example/categories');
    expect(locations).not.toContain('https://silver.example/brands');
  });
});
