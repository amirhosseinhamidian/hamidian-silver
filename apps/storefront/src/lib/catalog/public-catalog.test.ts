import {
  buildCatalogHref,
  parseCatalogSearchParams,
} from '@/lib/catalog/public-catalog';
import { describe, expect, it } from 'vitest';

describe('parseCatalogSearchParams', () => {
  it('normalizes supported storefront catalog filters', () => {
    expect(
      parseCatalogSearchParams({
        page: '3',
        q: '  انگشتر نقره  ',
        category: 'rings',
        brand: 'hamidian',
        sort: 'price-desc',
      }),
    ).toEqual({
      page: 3,
      pageSize: 24,
      q: 'انگشتر نقره',
      category: 'rings',
      brand: 'hamidian',
      sort: 'price-desc',
    });
  });

  it('falls back to safe defaults for invalid paging and sorting values', () => {
    expect(
      parseCatalogSearchParams({
        page: '-2',
        sort: 'unsupported',
      }),
    ).toEqual({
      page: 1,
      pageSize: 24,
      q: undefined,
      category: undefined,
      brand: undefined,
      sort: 'newest',
    });
  });
});

describe('buildCatalogHref', () => {
  it('preserves active filters while changing the page', () => {
    const filters = parseCatalogSearchParams({
      q: 'انگشتر',
      category: 'rings',
      sort: 'price-asc',
    });

    expect(buildCatalogHref(filters, { page: 2 })).toBe(
      '/products?q=%D8%A7%D9%86%DA%AF%D8%B4%D8%AA%D8%B1&category=rings&sort=price-asc&page=2',
    );
  });

  it('omits default and cleared filters from the URL', () => {
    const filters = parseCatalogSearchParams({
      q: 'ring',
      category: 'rings',
      brand: 'brand-a',
      sort: 'price-desc',
      page: '4',
    });

    expect(
      buildCatalogHref(filters, {
        page: 1,
        q: undefined,
        category: undefined,
        brand: undefined,
        sort: 'newest',
      }),
    ).toBe('/products');
  });
});
