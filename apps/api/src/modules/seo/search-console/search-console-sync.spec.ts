import { aggregateDailyMetrics, searchConsoleDay } from './search-console-sync-data';
import { parseReportedUrl } from './search-console-url-inventory';

it('uses California calendar dates on both sides of a DST change', () => {
  expect(searchConsoleDay(new Date('2026-03-08T07:59:59Z'))).toEqual(new Date('2026-03-07'));
  expect(searchConsoleDay(new Date('2026-03-08T08:00:00Z'))).toEqual(new Date('2026-03-08'));
  expect(searchConsoleDay(new Date('2026-03-09T07:00:00Z'))).toEqual(new Date('2026-03-09'));
});

it('weights position and CTR by impressions and preserves missing data', () => {
  const row = { clicks: 2, impressions: 4, averagePosition: 2 };
  expect(aggregateDailyMetrics([row, { clicks: 1, impressions: 8, averagePosition: 8 }])).toEqual({
    clicks: 3,
    impressions: 12,
    ctr: 0.25,
    averagePosition: 6,
  });
  expect(
    aggregateDailyMetrics([row, { clicks: 0, impressions: 4, averagePosition: null }]),
  ).toMatchObject({ averagePosition: null });
  expect(aggregateDailyMetrics([])).toBeNull();
});

it('retains the observed URL and keeps different query parameters distinct', () => {
  const url = parseReportedUrl('https://hamidian.shop/products/silver-ring/?color=blue');
  expect(url).toMatchObject({
    reportedPath: '/products/silver-ring/',
    reportedSearch: '?color=blue',
    normalizedPath: '/products/silver-ring',
    candidate: { kind: 'PRODUCT', slug: 'silver-ring' },
  });
  expect(url.urlKey).not.toBe(
    parseReportedUrl('https://hamidian.shop/products/silver-ring/?color=red').urlKey,
  );
  expect(parseReportedUrl('https://other.hamidian.shop/products/silver-ring').candidate).toBeNull();
  expect(parseReportedUrl('https://hamidian.shop/products/a%2Fb').candidate).toBeNull();
});
