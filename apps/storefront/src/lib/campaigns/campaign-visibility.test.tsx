import { act, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { CampaignQuotaProgress } from '@/components/catalog/campaign-quota-progress';
import { CatalogPrice } from '@/components/catalog/catalog-price';
import { CampaignNavigationItem } from '@/components/layout/campaign-navigation-item';
import { formatTomanPrice } from '@/lib/catalog/presentation';
import { CampaignVisibilityProvider } from './campaign-visibility';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it('removes live campaign prices, stock and navigation from an open page after a pause', async () => {
  vi.useFakeTimers();
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  const campaignId = '10000000-0000-4000-8000-000000000001';
  const name = 'تخفیف زمستان';
  const endsAt = new Date(Date.now() + 600_000).toISOString();
  const fetchActivity = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ activeIds: [campaignId] }))
    .mockResolvedValueOnce(Response.json({ activeIds: [] }));
  vi.stubGlobal('fetch', fetchActivity);
  render(
    <CampaignVisibilityProvider>
      <CatalogPrice
        sale={100_000}
        priceClassName=""
        offer={{
          campaignId,
          name,
          endsAt,
          conditions: [],
          minimumToman: null,
          price: {
            regularToman: 100_000,
            discountToman: 10_000,
            discountPercent: 10,
            finalToman: 90_000,
          },
        }}
      />
      <CampaignQuotaProgress
        quota={{ campaignId, name, endsAt, limit: 3, sold: 1, remaining: 2 }}
      />
      <ul>
        <CampaignNavigationItem
          campaign={{
            campaignId,
            name,
            endsAt,
            message: name,
            ctaLabel: name,
            ctaPath: '/campaigns/winter',
            media: null,
          }}
        />
      </ul>
    </CampaignVisibilityProvider>,
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
  expect(screen.getByText(formatTomanPrice(90_000))).toBeInTheDocument();
  expect(screen.getByRole('progressbar')).toBeInTheDocument();
  expect(screen.getByRole('link', { name })).toBeInTheDocument();

  await act(async () => {
    await vi.advanceTimersByTimeAsync(30_000);
  });
  expect(fetchActivity).toHaveBeenCalledTimes(2);
  expect(screen.getByText(formatTomanPrice(100_000))).toBeInTheDocument();
  expect(screen.queryByText(formatTomanPrice(90_000))).not.toBeInTheDocument();
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name })).not.toBeInTheDocument();
});
