import { describe, expect, it } from 'vitest';

import {
  brandSeoDescription,
  brandSeoTitle,
  categorySeoDescription,
  categorySeoTitle,
  productSeoDescription,
  ROOT_CATALOG_SEO,
} from '@/lib/seo/content-copy';
import type {
  PublicCatalogBrandPage,
  PublicCatalogCategoryPage,
} from '@/lib/catalog/public-catalog';

const category = (overrides: Partial<PublicCatalogCategoryPage> = {}): PublicCatalogCategoryPage => ({
  id: 'category-1',
  name: 'دستبند',
  slug: 'bracelets',
  description: null,
  parentId: null,
  sortOrder: 1,
  image: null,
  ...overrides,
});

const brand = (overrides: Partial<PublicCatalogBrandPage> = {}): PublicCatalogBrandPage => ({
  id: 'brand-1',
  name: 'Cartier',
  slug: 'cartier',
  description: null,
  image: null,
  originCountry: null,
  ...overrides,
});

describe('SEO content fallbacks', () => {
  it('builds natural category intent without duplicating silver', () => {
    expect(categorySeoTitle(category())).toBe('خرید دستبند');
    expect(
      categorySeoDescription(category({ name: 'گردنبند نقره', slug: 'silver-necklaces' })),
    ).toContain('مدل‌های گردنبند نقره در گالری حمیدیان');
  });

  it('uses explicit collection descriptions before generated copy', () => {
    expect(categorySeoDescription(category({ description: '  توضیح اختصاصی دسته  ' }))).toBe(
      'توضیح اختصاصی دسته',
    );
    expect(brandSeoTitle(brand())).toBe('کالکشن Cartier');
    expect(brandSeoDescription(brand({ description: 'کالکشن انتخاب‌شده' }))).toBe(
      'کالکشن انتخاب‌شده',
    );
  });

  it('prefers product short copy and otherwise creates a useful fallback', () => {
    const product = {
      name: 'دستبند نقره ماری',
      shortDescription: 'طراحی لوکس و مینیمال',
      description: 'توضیح کامل',
    };

    expect(productSeoDescription(product)).toBe('طراحی لوکس و مینیمال');
    expect(
      productSeoDescription({
        ...product,
        shortDescription: null,
        description: null,
      }),
    ).toContain('قیمت، تصاویر، مشخصات، سایزبندی و موجودی');
  });

  it('defines the root catalog purchase intent', () => {
    expect(ROOT_CATALOG_SEO.title).toBe('خرید محصولات نقره');
  });
});
