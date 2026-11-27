import { describe, expect, it } from 'vitest';
import { overviewHref, readSearchOverviewFilters } from './search-overview-model';

describe('Search Console report filters', () => {
  it('defaults to 28 Pacific days ending three days before the current Pacific date', () => {
    const filters = readSearchOverviewFilters({}, new Date('2026-11-21T04:00:00Z'));
    expect(filters.base).toMatchObject({
      searchType: 'web',
      startDate: '2026-10-21',
      endDate: '2026-11-17',
    });
  });

  it('keeps the selected device and period when switching or paging tables', () => {
    const filters = readSearchOverviewFilters({
      startDate: '2026-11-01',
      endDate: '2026-11-15',
      segment: 'MOBILE',
      q: 'انگشتر',
      direction: 'asc',
      sort: 'position',
      page: '2',
    });
    expect(filters.rows).toMatchObject({ device: 'MOBILE', q: 'انگشتر', sort: 'position' });
    const url = new URL(
      overviewHref(filters, { kind: 'page', q: undefined, page: 1 }),
      'https://example.test',
    );
    expect(url.pathname).toBe('/seo');
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      startDate: '2026-11-01',
      endDate: '2026-11-15',
      segment: 'MOBILE',
      sort: 'position',
      kind: 'page',
    });
    expect(url.searchParams.has('q')).toBe(false);
    expect(url.searchParams.has('page')).toBe(false);
  });

  it('uses the unsegmented view for branded requests outside Web', () => {
    expect(readSearchOverviewFilters({ searchType: 'video', segment: 'BRANDED' })).toMatchObject({
      base: { searchType: 'video', brand: undefined },
      segment: '',
    });
  });
});
