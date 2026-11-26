import { describe, expect, it } from 'vitest';
import { festivalReportHref, parseFestivalFilters } from './festival-report';

const path = '/growth/festivals/test';
const period = { from: '2026-11-01', to: '2026-11-26' };

describe('festival report filters', () => {
  it('round-trips product, category, state, sort and pagination', () => {
    const filters = parseFestivalFilters({
      ...period,
      product: 'انگشتر-نقره',
      category: 'silver',
      orderState: 'CONFIRMED',
      section: 'offers',
      sort: 'asc',
      page: '8',
    });
    const url = new URL(festivalReportHref(path, filters), 'https://admin.example');
    expect(url.pathname).toBe(path);
    expect(parseFestivalFilters(Object.fromEntries(url.searchParams))).toEqual(filters);
  });

  it('normalizes unsupported controls and limits pages', () => {
    expect(
      parseFestivalFilters({
        ...period,
        page: '5000',
        section: 'constructor',
        sort: 'other',
        orderState: 'toString',
      }),
    ).toMatchObject({ page: 1000, section: 'products', sort: 'desc', orderState: undefined });
  });
});
