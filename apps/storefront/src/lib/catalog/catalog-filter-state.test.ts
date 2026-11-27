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
      categories: ['necklaces', 'rings'],
      brands: ['atelier', 'sample'],
      minWeightGrams: 4.25,
      attributes: [
        { code: 'fineness', min: 925 },
        { code: 'intended-for', values: ['men', 'women'] },
      ],
    });
  });

  it('generates the same URL for reordered and repeated selections', () => {
    const paths = [
      'category=rings&category=necklaces&brand=sample&brand=atelier&attr:audience=women&attr:audience=men&min:fineness=925',
      'min:fineness=925&attr:audience=men&attr:audience=women&brand=atelier&brand=sample&category=necklaces&category=rings&category=rings',
    ].map((query) =>
      buildFacetedCatalogHref(
        '/products',
        parseCatalogFacetFilters(catalogSearchParamsFromEntries(new URLSearchParams(query))),
      ),
    );
    expect(paths[0]).toBe(paths[1]);
  });

  it.each(['2e0', '02', ' 2', '0', ['2', '2']].map((page) => ({ page })))(
    'uses page one for the malformed value $page',
    ({ page }) => {
      expect(parseCatalogFacetFilters({ page }).page).toBe(1);
    },
  );
});
