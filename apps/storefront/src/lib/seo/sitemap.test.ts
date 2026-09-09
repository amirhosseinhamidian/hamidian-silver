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
        salePriceToman: 1_000_000,
        compareAtPriceToman: null,
        sizeMode: 'NONE',
        brand: null,
        categories: [],
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
        id: 'category-1',
        name: 'انگشتر',
        slug: 'rings',
        description: null,
        parentId: null,
        sortOrder: 1,
        image: null,
        seoNoIndex: false,
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
        sections: [],
        seoTitle: null,
        seoDescription: null,
        seoCanonicalPath: '/story',
        seoNoIndex: false,
        seoOgMedia: null,
      },
    ] satisfies PublicContentPage[];

    const sitemap = buildStorefrontSitemap({ products, categories, brands, contentPages }, origin);

    expect(sitemap).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ url: 'https://silver.example/' }),
        expect.objectContaining({ url: 'https://silver.example/story' }),
        expect.objectContaining({ url: 'https://silver.example/categories/rings' }),
        expect.objectContaining({
          url: 'https://silver.example/products/ring-canonical',
          images: ['https://silver.example/media/ring.webp'],
        }),
      ]),
    );
    expect(sitemap.some((entry) => entry.url.includes('hidden'))).toBe(false);
  });
});
