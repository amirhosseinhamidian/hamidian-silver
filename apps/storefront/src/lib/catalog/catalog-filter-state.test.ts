import { describe, expect, it } from 'vitest';

import {
  buildFacetedCatalogHref,
  catalogFacetQuery,
  catalogSearchParamsFromEntries,
  hasCatalogFacetFilters,
  parseCatalogFacetFilters,
} from './catalog-filter-state';

describe('catalog facet URL state', () => {
  it('preserves repeated selection, numeric filters and scope across a URL round trip', () => {
    const initial = parseCatalogFacetFilters({
      category: ['rings', 'necklaces', 'rings'],
      brand: ['sample', 'atelier'],
      country: 'italy',
      minWeightGrams: '۴٫۲۵',
      'attr:intended-for': ['women', 'men'],
      'min:fineness': '۹۲۵',
      sort: 'price-asc',
      page: '2',
    });
    const url = new URL(
      buildFacetedCatalogHref('/categories/silver', initial),
      'https://example.test',
    );
    expect(parseCatalogFacetFilters(catalogSearchParamsFromEntries(url.searchParams))).toEqual(
      initial,
    );
    expect(hasCatalogFacetFilters(initial)).toBe(true);
    expect(catalogFacetQuery(initial, { category: 'silver' })).toMatchObject({
      scopeCategory: 'silver',
      scopeCountry: 'italy',
      categories: ['rings', 'necklaces'],
      brands: ['sample', 'atelier'],
      minWeightGrams: 4.25,
      attributes: [
        { code: 'intended-for', values: ['women', 'men'] },
        { code: 'fineness', min: 925 },
      ],
    });
  });
});
