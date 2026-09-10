import { describe, expect, it } from 'vitest';

import {
  parseAdminBrands,
  parseAdminProduct,
  parseAdminCategories,
  parseAdminCountries,
  parseCatalogFilters,
  parseCatalogSizes,
  parseProductList,
  productStatusLabel,
} from '@/lib/catalog/catalog-model';

const product = {
  id: '10000000-0000-4000-8000-000000000001',
  name: 'انگشتر نقره',
  slug: 'silver-ring-01',
  shortDescription: null,
  description: null,
  status: 'ACTIVE',
  sizeMode: 'SIZED',
  salePriceToman: 4_500_000,
  compareAtPriceToman: 5_000_000,
  createdAt: '2026-09-07T10:00:00.000Z',
  updatedAt: '2026-09-07T11:00:00.000Z',
  brand: { id: 'brand-1', name: 'حمیدیان' },
  country: null,
  categories: [{ category: { id: 'category-1', name: 'انگشتر' } }],
  variants: [
    {
      id: 'variant-1',
      sku: 'RING-52',
      name: 'سایز ۵۲',
      weightGrams: '4.250',
      isActive: true,
      size: { id: 'size-1', label: '۵۲' },
    },
  ],
  media: [
    {
      mediaId: 'media-1',
      url: 'http://localhost:3000/media/catalog/ring.webp',
      altText: 'نمای روبه‌رو',
      isPrimary: true,
      sortOrder: 0,
      media: {
        id: 'media-1',
        mimeType: 'image/webp',
        originalName: 'ring.webp',
        sizeBytes: 2048,
        width: null,
        height: null,
        altText: null,
      },
    },
  ],
  attributes: [
    { id: 'attribute-2', key: 'نوع آبکاری', value: 'رودیوم', sortOrder: 2 },
    { id: 'attribute-1', key: 'جنس نگین', value: 'زیرکونیا', sortOrder: 1 },
  ],
};

describe('catalog model', () => {
  it('parses nested admin product relations and Decimal values', () => {
    expect(parseAdminProduct(product)).toMatchObject({
      name: 'انگشتر نقره',
      status: 'ACTIVE',
      mediaCount: 1,
      media: [{ id: 'media-1', isPrimary: true, altText: 'نمای روبه‌رو' }],
      categories: [{ id: 'category-1', name: 'انگشتر' }],
      variants: [{ sku: 'RING-52', weightGrams: 4.25, size: { label: '۵۲' } }],
      attributes: [
        { key: 'جنس نگین', value: 'زیرکونیا', sortOrder: 1 },
        { key: 'نوع آبکاری', value: 'رودیوم', sortOrder: 2 },
      ],
    });
  });

  it('parses paginated responses and rejects malformed records', () => {
    expect(parseProductList({ items: [product], total: 23, page: 2, limit: 20 })).toMatchObject({
      total: 23,
      page: 2,
      limit: 20,
    });
    expect(parseProductList({ items: [{ id: 'broken' }] })).toBeNull();
  });

  it('normalizes filters, Persian page numbers and all options', () => {
    expect(
      parseCatalogFilters({
        q: '  ring  ',
        status: 'ACTIVE',
        brandId: 'all',
        categoryId: 'category-1',
        page: '۲',
        limit: '۵۰',
      }),
    ).toEqual({
      q: 'ring',
      status: 'ACTIVE',
      brandId: '',
      categoryId: 'category-1',
      page: 2,
      limit: 50,
    });
    expect(productStatusLabel('ARCHIVED')).toBe('آرشیوشده');
  });

  it('parses operational size metadata', () => {
    expect(
      parseCatalogSizes([
        { id: 'size-1', code: '52', label: 'سایز ۵۲', sortOrder: 2, isActive: false },
      ]),
    ).toEqual([{ id: 'size-1', code: '52', label: 'سایز ۵۲', sortOrder: 2, active: false }]);
    expect(parseCatalogSizes([{ id: 'size-1', label: 'ناقص' }])).toBeNull();
  });

  it('parses category hierarchy, counts and public image URLs', () => {
    expect(
      parseAdminCategories([
        {
          id: 'category-2',
          name: 'انگشتر زنانه',
          slug: 'women-rings',
          description: null,
          parentId: 'category-1',
          parent: { id: 'category-1', name: 'انگشتر' },
          sortOrder: 2,
          isActive: true,
          childCount: 0,
          productCount: 4,
          createdAt: '2026-09-07T10:00:00.000Z',
          updatedAt: '2026-09-07T11:00:00.000Z',
          image: {
            id: 'media-1',
            url: 'https://api.example/media/category.webp',
            mimeType: 'image/webp',
            altText: 'انگشتر زنانه',
          },
        },
      ]),
    ).toMatchObject([
      {
        id: 'category-2',
        parent: { id: 'category-1', name: 'انگشتر' },
        productCount: 4,
        image: { id: 'media-1', url: 'https://api.example/media/category.webp' },
      },
    ]);
  });

  it('parses operational brand and country metadata', () => {
    const base = {
      id: 'reference-1',
      name: 'حمیدیان',
      slug: 'hamidian',
      description: 'توضیحات',
      isActive: true,
      productCount: 4,
      createdAt: '2026-09-07T10:00:00.000Z',
      updatedAt: '2026-09-07T11:00:00.000Z',
      image: {
        id: 'media-1',
        url: 'https://api.example/media/logo.webp',
        mimeType: 'image/webp',
        altText: null,
      },
    };

    expect(parseAdminBrands([base])).toEqual([
      expect.objectContaining({ name: 'حمیدیان', productCount: 4, active: true }),
    ]);
    expect(parseAdminCountries([{ ...base, name: 'ایران', isoCode: 'IR' }])).toEqual([
      expect.objectContaining({ name: 'ایران', isoCode: 'IR', productCount: 4 }),
    ]);
    expect(parseAdminCountries([{ ...base, isoCode: null }])).toBeNull();
  });
});
