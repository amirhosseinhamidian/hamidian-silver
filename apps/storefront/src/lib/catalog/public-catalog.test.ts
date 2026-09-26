import {
  buildCatalogCollectionHref,
  buildCatalogHref,
  buildCategoryBreadcrumbItems,
  selectPrimaryCatalogCategory,
  parseCatalogSearchParams,
} from '@/lib/catalog/public-catalog';
import { describe, expect, it } from 'vitest';

describe('parseCatalogSearchParams', () => {
  it('normalizes supported storefront catalog filters', () => {
    expect(
      parseCatalogSearchParams({
        page: '3',
        q: '  انگشتر‌ نقره كياني  ',
        category: 'rings',
        brand: 'hamidian',
        country: 'iran',
        sort: 'price-desc',
      }),
    ).toEqual({
      page: 3,
      pageSize: 24,
      q: 'انگشتر نقره کیانی',
      category: 'rings',
      brand: 'hamidian',
      country: 'iran',
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
      country: undefined,
      sort: 'newest',
    });
  });
});

describe('buildCatalogHref', () => {
  it('preserves active filters while changing the page', () => {
    const filters = parseCatalogSearchParams({
      q: 'انگشتر',
      category: 'rings',
      country: 'iran',
      sort: 'price-asc',
    });

    expect(buildCatalogHref(filters, { page: 2 })).toBe(
      '/products?q=%D8%A7%D9%86%DA%AF%D8%B4%D8%AA%D8%B1&category=rings&country=iran&sort=price-asc&page=2',
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
        country: undefined,
        sort: 'newest',
      }),
    ).toBe('/products');
  });
});

describe('buildCatalogCollectionHref', () => {
  it('keeps collection routes focused on sorting and pagination', () => {
    const filters = parseCatalogSearchParams({
      q: 'ignored',
      category: 'rings',
      brand: 'brand-a',
      sort: 'price-desc',
      page: '3',
    });

    expect(buildCatalogCollectionHref('/categories/rings', filters)).toBe(
      '/categories/rings?sort=price-desc&page=3',
    );
  });

  it('omits default collection query values', () => {
    const filters = parseCatalogSearchParams({
      sort: 'price-asc',
      page: '4',
    });

    expect(
      buildCatalogCollectionHref('/brands/hamidian', filters, {
        sort: 'newest',
        page: 1,
      }),
    ).toBe('/brands/hamidian');
  });
});

describe('buildCategoryBreadcrumbItems', () => {
  it('includes the categories hub and active parent hierarchy', () => {
    const categories = [
      {
        id: 'jewelry',
        name: 'زیورآلات',
        slug: 'jewelry',
        description: null,
        parentId: null,
        sortOrder: 1,
        image: null,
      },
      {
        id: 'rings',
        name: 'انگشتر',
        slug: 'rings',
        description: null,
        parentId: 'jewelry',
        sortOrder: 2,
        image: null,
      },
      {
        id: 'women-rings',
        name: 'انگشتر زنانه',
        slug: 'women-rings',
        description: null,
        parentId: 'rings',
        sortOrder: 3,
        image: null,
      },
    ];

    expect(buildCategoryBreadcrumbItems(categories, categories[2]!)).toEqual([
      { label: 'خانه', href: '/' },
      { label: 'دسته‌بندی‌ها', href: '/categories' },
      { label: 'زیورآلات', href: '/categories/jewelry' },
      { label: 'انگشتر', href: '/categories/rings' },
      { label: 'انگشتر زنانه', href: '/categories/women-rings' },
    ]);
  });
});

describe('selectPrimaryCatalogCategory', () => {
  it('prefers the deepest assigned category for product breadcrumbs', () => {
    const categories = [
      {
        id: 'root',
        name: 'زیورآلات',
        slug: 'jewelry',
        description: null,
        parentId: null,
        sortOrder: 1,
        image: null,
      },
      {
        id: 'rings',
        name: 'انگشتر',
        slug: 'rings',
        description: null,
        parentId: 'root',
        sortOrder: 1,
        image: null,
      },
      {
        id: 'women-rings',
        name: 'انگشتر زنانه',
        slug: 'women-rings',
        description: null,
        parentId: 'rings',
        sortOrder: 1,
        image: null,
      },
    ];

    expect(
      selectPrimaryCatalogCategory(categories, [{ id: 'rings' }, { id: 'women-rings' }])?.id,
    ).toBe('women-rings');
  });
});
