import { act, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { StorefrontAnnouncementBar, type StorefrontAnnouncement } from './storefront-announcement';
import type { PublicCampaignBanner } from '@/lib/home/public-campaign-banner';

afterEach(() => vi.useRealTimers());

it('counts down to the festival end and restores the ordinary announcement at the placement cutoff', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-26T12:00:00Z'));
  const announcement: StorefrontAnnouncement = {
    enabled: true,
    message: 'اعلان عادی',
    countdown: { mode: 'none' },
  };
  const campaign: PublicCampaignBanner = {
    name: 'جشنواره',
    message: 'اعلان جشنواره',
    endsAt: '2026-11-26T12:00:10Z',
    countdownEndsAt: '2026-11-26T14:05:00Z',
    ctaLabel: null,
    ctaPath: null,
    media: null,
  };
  render(
    <StorefrontAnnouncementBar
      announcement={announcement}
      campaign={campaign}
      campaignSeconds={7_500}
    />,
  );
  act(() => {
    vi.advanceTimersByTime(20);
  });
  const notice = screen.getByRole('complementary', { name: 'جشنواره' });
  expect(within(notice).getByText('۰۲ ساعت')).toBeInTheDocument();
  expect(screen.queryByText('اعلان عادی')).not.toBeInTheDocument();

  act(() => {
    vi.advanceTimersByTime(10_000);
  });
  expect(screen.queryByRole('complementary', { name: 'جشنواره' })).not.toBeInTheDocument();
  expect(screen.getByText('اعلان عادی')).toBeInTheDocument();
});
