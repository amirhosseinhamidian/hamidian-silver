import { describe, expect, it } from 'vitest';

import { normalizeCatalogSearchText } from '@/lib/catalog/search-normalization';

describe('normalizeCatalogSearchText', () => {
  it('normalizes Persian, Arabic and Latin digits in the same query', () => {
    expect(normalizeCatalogSearchText(' ＳＩＬＶＥＲ-RING ۹٢۵ ')).toBe('silver ring 925');
  });
  it('normalizes Arabic Persian letters, half-spaces and repeated whitespace', () => {
    expect(normalizeCatalogSearchText('  انگشتر‌ نقره كيان  ')).toBe('انگشتر نقره کیان');
  });
});
