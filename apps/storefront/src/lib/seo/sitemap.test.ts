import { describe, expect, it } from 'vitest';

import type {
  PublicCatalogBrandPage,
  PublicCatalogCategoryPage,
  PublicCatalogProductSummary,
} from '@/lib/catalog/public-catalog';
import type { PublicContentPage } from '@/lib/content/public-content-page';
import { buildStorefrontSitemap } from '@/lib/seo/sitemap';

const origin = new URL('https://silver.example');

describe('buildStorefrontSitemap', () => {
  it('uses canonicals, excludes no-index records and includes product images', () => {
    const products = [
      {
        id: 'product-1',
        name: 'انگشتر',
        slug: 'ring',
        shortDescription: null,
        seoCanonicalPath: '/products/ring-canonical',
        seoNoIndex: false,
        updatedAt: '2026-09-25T10:00:00.000Z',
        salePriceToman: 1_000_000,
        compareAtPriceToman: null,
        sizeMode: 'NONE',
        brand: null,
        categories: [
          {
            id: 'category-1',
            name: 'انگشتر',
            slug: 'rings',
            description: null,
            parentId: 'category-parent',
            sortOrder: 1,
            image: null,
          },
        ],
        primaryMedia: {
          url: '/media/ring.webp',
          mimeType: 'image/webp',
          altText: null,
          width: 1200,
          height: 1200,
        },
        availableQuantity: 1,
        isAvailable: true,
      },
      {
        id: 'product-2',
        name: 'محصول مخفی',
        slug: 'hidden',
        shortDescription: null,
        seoNoIndex: true,
        salePriceToman: null,
        compareAtPriceToman: null,
        sizeMode: 'NONE',
        brand: null,
        categories: [],
        primaryMedia: null,
        availableQuantity: 0,
        isAvailable: false,
      },
    ] satisfies PublicCatalogProductSummary[];
    const categories = [
      {
        id: 'category-parent',
        name: 'زیورآلات',
        slug: 'jewelry',
        description: null,
        parentId: null,
        sortOrder: 0,
        image: null,
        seoNoIndex: false,
        updatedAt: '2026-09-20T08:00:00.000Z',
      },
      {
        id: 'category-1',
        name: 'انگشتر',
        slug: 'rings',
        description: null,
        parentId: 'category-parent',
        sortOrder: 1,
        image: null,
        seoNoIndex: false,
        updatedAt: '2026-09-24T08:00:00.000Z',
      },
      {
        id: 'category-empty',
        name: 'دسته خالی',
        slug: 'empty-category',
        description: null,
        parentId: null,
        sortOrder: 2,
        image: null,
        seoNoIndex: false,
        updatedAt: '2026-09-24T08:00:00.000Z',
      },
    ] satisfies PublicCatalogCategoryPage[];
    const brands = [
      {
        id: 'brand-1',
        name: 'برند مخفی',
        slug: 'hidden-brand',
        description: null,
        image: null,
        originCountry: null,
        seoNoIndex: true,
      },
    ] satisfies PublicCatalogBrandPage[];
    const contentPages = [
      {
        key: 'ABOUT',
        title: 'درباره ما',
        eyebrow: null,
        subtitle: null,
        body: null,
        heroMedia: null,
        heroMobileMedia: null,
        sections: [],
        seoTitle: null,
        seoDescription: null,
        seoCanonicalPath: '/story',
        seoNoIndex: false,
        seoOgMedia: null,
        updatedAt: '2026-09-23T09:30:00.000Z',
      },
    ] satisfies PublicContentPage[];

    const sitemap = buildStorefrontSitemap({ products, categories, brands, contentPages }, origin);

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
          url: 'https://silver.example/products/ring-canonical',
          lastModified: new Date('2026-09-25T10:00:00.000Z'),
          images: ['https://silver.example/media/ring.webp'],
        }),
      ]),
    );
    expect(sitemap.some((entry) => entry.url.includes('hidden'))).toBe(false);
    expect(sitemap.some((entry) => entry.url.includes('empty-category'))).toBe(false);
  });
});
