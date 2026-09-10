import { describe, expect, it } from 'vitest';

import { normalizeCatalogSearchText } from '@/lib/catalog/search-normalization';

describe('normalizeCatalogSearchText', () => {
  it('normalizes Arabic Persian letters, half-spaces and repeated whitespace', () => {
    expect(normalizeCatalogSearchText('  انگشتر‌ نقره كيان  ')).toBe('انگشتر نقره کیان');
  });
});
