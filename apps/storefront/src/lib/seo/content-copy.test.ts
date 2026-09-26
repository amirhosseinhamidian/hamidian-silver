import { describe, expect, it } from 'vitest';

import {
  brandSeoDescription,
  brandSeoTitle,
  categorySeoDescription,
  categorySeoTitle,
  productSeoDescription,
  HOME_SEO,
  ROOT_CATALOG_SEO,
} from '@/lib/seo/content-copy';
import type {
  PublicCatalogBrandPage,
  PublicCatalogCategoryPage,
} from '@/lib/catalog/public-catalog';

const category = (
  overrides: Partial<PublicCatalogCategoryPage> = {},
): PublicCatalogCategoryPage => ({
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
    expect(categorySeoTitle(category())).toBe('خرید دستبند نقره');
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

  it('avoids using the intentionally short product card copy as the meta description', () => {
    const product = {
      name: 'دستبند نقره ماری',
      shortDescription: 'طراحی لوکس و مینیمال',
      description: null,
      brand: { name: 'کارتیر' },
      country: { name: 'ایتالیا' },
      categories: [{ name: 'دستبند' }],
    };

    expect(productSeoDescription(product)).toBe(
      'خرید و مشاهده دستبند نقره ماری در گالری حمیدیان؛ برند کارتیر، ساخت ایتالیا، دسته دستبند؛ بررسی قیمت، تصاویر، مشخصات، سایزبندی و موجودی محصول.',
    );
  });

  it('uses a concise useful long description when it is suitable for a snippet', () => {
    const description =
      'دستبند نقره با طراحی ظریف، آبکاری رادیوم و ساخت دقیق که برای استفاده روزمره و استایل مینیمال انتخاب مناسبی است.';

    expect(
      productSeoDescription({
        name: 'دستبند نقره',
        shortDescription: 'طراحی ظریف و مینیمال',
        description,
        brand: null,
        country: null,
        categories: [],
      }),
    ).toBe(description);
  });

  it('defines home and root catalog purchase intents', () => {
    expect(HOME_SEO.title).toContain('خرید زیورآلات نقره');
    expect(ROOT_CATALOG_SEO.title).toBe('خرید محصولات نقره');
  });
});
