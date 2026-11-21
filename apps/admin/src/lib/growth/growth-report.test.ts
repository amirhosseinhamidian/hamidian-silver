import { describe, expect, it } from 'vitest';
import {
  growthMetricFields,
  growthQuery,
  growthReportCsv,
  parseGrowthFilters,
  type GrowthDashboard,
  type GrowthMetrics,
} from './growth-report';

describe('growth reports', () => {
  it('defaults to 30 Tehran days and preserves separate paging for the report and cost history', () => {
    const now = new Date('2026-11-20T21:00:00Z');
    const filters = parseGrowthFilters(
      { page: '2', costPage: '3', device: 'mobile', category: 'rings' },
      now,
    );
    expect(filters).toMatchObject({ from: '2026-10-23', to: '2026-11-21' });
    expect(Object.fromEntries(growthQuery(filters))).toMatchObject({
      device: 'mobile',
      category: 'rings',
      page: '2',
    });
    expect(Object.fromEntries(growthQuery(filters, true))).toEqual({
      from: '2026-10-23',
      to: '2026-11-21',
      page: '3',
    });
  });

  it('exports the aggregate page as CSV with safe labels and empty missing cells', () => {
    const totals = Object.fromEntries(growthMetricFields.map(([key]) => [key, 0])) as GrowthMetrics;
    const report: GrowthDashboard = {
      period: { from: '2026-11-20', to: '2026-11-20', timezone: 'Asia/Tehran' },
      totals,
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
    expect(csv).toContain(',-500,,');
    expect(csv.trim().split('\r\n')).toHaveLength(2);
  });
});
