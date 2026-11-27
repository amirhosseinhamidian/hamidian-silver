import { act, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import { CampaignBanner } from '@/components/home/campaign-banner';

afterEach(() => {
  vi.useRealTimers();
});

it('removes the expired banner and link from an open homepage', () => {
  vi.useFakeTimers();
  const start = new Date('2026-11-21T08:00:00.000Z');
  vi.setSystemTime(start);
  render(
    <CampaignBanner
      banner={{
        name: 'کمپین زمستان',
        message: 'کالکشن نقره',
        ctaLabel: 'دیدن محصولات',
        ctaPath: '/products',
        media: null,
        endsAt: new Date(start.valueOf() + 2_000).toISOString(),
      }}
    />,
  );

  expect(screen.getByRole('link', { name: 'دیدن محصولات' })).toHaveAttribute('href', '/products');
  act(() => {
    vi.advanceTimersByTime(1_999);
  });
  expect(screen.getByRole('complementary', { name: 'کمپین زمستان' })).toBeInTheDocument();
  act(() => {
    vi.advanceTimersByTime(1);
  });
  expect(screen.queryByRole('complementary', { name: 'کمپین زمستان' })).not.toBeInTheDocument();
});
