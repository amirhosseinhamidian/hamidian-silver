import {
  catalogSearchMetricTerm,
  catalogSearchTerms,
  normalizeCatalogSearch,
} from './catalog-search';

describe('normalizeCatalogSearch', () => {
  it('normalizes Arabic Persian letters, half-spaces and repeated whitespace', () => {
    expect(normalizeCatalogSearch('  انگشتر‌ نقره كيان  ')).toBe('انگشتر نقره کیان');
  });
});

it('matches equivalent digits, slugs, and common Persian and English terms', () => {
  const query = normalizeCatalogSearch('  ＳＩＬＶＥＲ-RING ۹٢۵  ');
  expect(query).toBe('silver ring 925');
  expect(catalogSearchTerms(query)).toEqual([
    'silver ring 925',
    'نقره انگشتر 925',
    'نقره rings 925',
  ]);
  expect(catalogSearchTerms(normalizeCatalogSearch('نیم‌ست'))).toEqual([
    'نیم ست',
    'half set',
    'نیمست',
  ]);
  expect(catalogSearchTerms('%_')).toEqual([]);
});

it('keeps the metrics dictionary closed to unknown words and personal values', () => {
  expect(catalogSearchMetricTerm(normalizeCatalogSearch('Silver ring ۹۲۵'))).toBe(
    '925 انگشتر نقره',
  );
  expect(catalogSearchMetricTerm(normalizeCatalogSearch('silver 09123456789'))).toBe('other');
  expect(catalogSearchMetricTerm(normalizeCatalogSearch('ring user@example.com'))).toBe('other');
  expect(catalogSearchMetricTerm(normalizeCatalogSearch('نام آزمایشی'))).toBe('other');
});
