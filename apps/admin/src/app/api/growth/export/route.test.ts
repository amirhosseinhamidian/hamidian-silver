import { beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  cookieGet: vi.fn(),
  get: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: mocks.cookieGet }) }));
vi.mock('@/lib/auth/server-api', () => ({ createAdminApiClient: () => ({ GET: mocks.get }) }));

import { GET } from './route';
import {
  growthMetricFields,
  type GrowthDashboard,
  type GrowthMetrics,
} from '@/lib/growth/growth-report';

const exportUrl = 'http://admin.local/api/growth/export';

beforeEach(() => {
  mocks.cookieGet.mockReset();
  mocks.get.mockReset();
});

it('exports the same filtered page as the dashboard when parameters are repeated', async () => {
  mocks.cookieGet.mockReturnValue({ value: 'test-session' });
  const totals = Object.fromEntries(growthMetricFields.map(([key]) => [key, 0])) as GrowthMetrics;
  const dashboard: GrowthDashboard = {
    period: { from: '2026-11-01', to: '2026-11-10', timezone: 'Asia/Tehran' },
    totals,
    generatedAt: '2026-11-11T00:00:00Z',
    daily: [],
    visitStages: null,
    leadingCampaign: null,
    leadingChannel: null,
    minimumChannelOrders: 20,
    page: 2,
    limit: 25,
    total: 26,
    items: [{ ...totals, source: 'newsletter', medium: 'email', campaignId: null, campaign: null }],
  };
  mocks.get.mockResolvedValue({ data: dashboard, response: { status: 200 } });

  const response = await GET(
    new Request(
      exportUrl +
        '?from=2026-11-01&from=2026-10-01&to=2026-11-10&product=ring&product=chain' +
        '&page=2&page=5&brand=sample&device=mobile&sort=net&compare=1&costPage=3',
    ),
  );

  expect(mocks.get).toHaveBeenCalledTimes(1);
  expect(mocks.get).toHaveBeenCalledWith('/api/v1/growth-attribution/dashboard', {
    params: {
      query: {
        from: '2026-11-01',
        to: '2026-11-10',
        product: 'ring',
        page: 2,
        brand: 'sample',
        device: 'mobile',
        sort: 'net',
      },
    },
    cache: 'no-store',
  });
  expect(response.status).toBe(200);
  expect(response.headers.get('Content-Disposition')).toBe(
    'attachment; filename="growth-report.csv"',
  );
  expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  expect((await response.text()).trim().split('\r\n')[1]).toContain('"newsletter","email"');
});

it('requires a session before contacting the reporting API', async () => {
  const response = await GET(new Request(exportUrl));
  expect(response.status).toBe(401);
  expect(mocks.get).not.toHaveBeenCalled();
});

it.each([403, 502])('returns status %i without a downloadable report', async (status) => {
  mocks.cookieGet.mockReturnValue({ value: 'test-session' });
  if (status === 403) {
    mocks.get.mockResolvedValue({ response: { status } });
  } else {
    mocks.get.mockRejectedValue(new Error('Reporting API unavailable'));
  }
  const response = await GET(new Request(exportUrl));
  expect(response.status).toBe(status);
  expect(response.headers.get('Content-Disposition')).toBeNull();
  expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  expect(await response.text()).toBe('');
});
