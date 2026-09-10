import { normalizeCatalogSearch } from './catalog-search';

describe('normalizeCatalogSearch', () => {
  it('normalizes Arabic Persian letters, half-spaces and repeated whitespace', () => {
    expect(normalizeCatalogSearch('  انگشتر‌ نقره كيان  ')).toBe('انگشتر نقره کیان');
  });
});
