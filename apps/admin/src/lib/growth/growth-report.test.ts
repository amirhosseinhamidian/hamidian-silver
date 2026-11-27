import { describe, expect, it } from 'vitest';
import {
  growthDashboardHref,
  growthMetricFields,
  growthQuery,
  growthReportCsv,
  growthTrendPoints,
  parseGrowthFilters,
  previousGrowthPeriod,
  type GrowthDashboard,
  type GrowthDashboardDay,
  type GrowthMetrics,
} from './growth-report';

describe('growth reports', () => {
  it('defaults to 30 Tehran days and preserves separate paging for the report and cost history', () => {
    const now = new Date('2026-11-20T21:00:00Z');
    const filters = parseGrowthFilters(
      {
        page: '2',
        costPage: '3',
        device: 'mobile',
        category: 'rings',
        product: 'ring',
        brand: 'sample',
        sort: 'net',
        compare: '1',
      },
      now,
    );
    expect(filters).toMatchObject({ from: '2026-10-23', to: '2026-11-21' });
    expect(Object.fromEntries(growthQuery(filters))).toMatchObject({
      device: 'mobile',
      category: 'rings',
      product: 'ring',
      brand: 'sample',
      sort: 'net',
      page: '2',
    });
    expect(Object.fromEntries(growthQuery(filters, true))).toEqual({
      from: '2026-10-23',
      to: '2026-11-21',
      page: '3',
    });
    expect(growthDashboardHref(filters)).toContain('&compare=1&costPage=3');
    expect(growthQuery(filters).has('compare')).toBe(false);
  });

  it('uses an adjacent equal comparison period and keeps signed refunds and wallet gaps in trend buckets', () => {
    expect(previousGrowthPeriod({ from: '2026-11-20', to: '2026-11-21' })).toEqual({
      from: '2026-11-18',
      to: '2026-11-19',
    });
    expect(previousGrowthPeriod({ from: '2026-11-31', to: '2026-12-01' })).toBeNull();
    const point: GrowthDashboardDay = {
      day: '2026-11-20',
      collectedToman: 1200,
      netCollectedToman: 1200,
      confirmedOrders: 2,
      campaignAttributedOrders: 1,
      newCustomers: 1,
      orderDiscountToman: 100,
      walletAppliedToman: null,
    };
    const days = [
      point,
      { ...point, day: '2026-11-21', netCollectedToman: -100, walletAppliedToman: 0 },
      { ...point, day: '2026-11-22', netCollectedToman: 0, walletAppliedToman: 50 },
    ];
    expect(growthTrendPoints(days, 'week', 'netCollectedToman').map(({ value }) => value)).toEqual([
      1200, -100,
    ]);
    expect(growthTrendPoints(days, 'week', 'walletAppliedToman').map(({ value }) => value)).toEqual(
      [null, 50],
    );
    expect(growthTrendPoints(days, 'month', 'netCollectedToman').map(({ value }) => value)).toEqual(
      [1100, 0],
    );
  });

  it('exports the aggregate page as CSV with safe labels and empty missing cells', () => {
    const totals = Object.fromEntries(growthMetricFields.map(([key]) => [key, 0])) as GrowthMetrics;
    const report: GrowthDashboard = {
      period: { from: '2026-11-20', to: '2026-11-20', timezone: 'Asia/Tehran' },
      totals,
      generatedAt: '2026-11-20T21:00:00Z',
      daily: [],
      visitStages: null,
      leadingCampaign: null,
      leadingChannel: null,
      minimumChannelOrders: 20,
      page: 1,
      limit: 25,
      total: 1,
      items: [
        {
          ...totals,
          source: '=malicious',
          medium: 'email',
          campaignId: null,
          campaign: 'a"b',
          netCollectedToman: -500,
          recordedSpendToman: null,
        },
      ],
    };
    const csv = growthReportCsv(report);
    expect(csv).toContain('"' + "'" + '=malicious","email","a""b",,');
    expect(csv).toContain(',-500,0,0,,');
    expect(csv.trim().split('\r\n')).toHaveLength(2);
  });
});
