import { describe, expect, it } from 'vitest';

import {
  parseAdminProduct,
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
});
