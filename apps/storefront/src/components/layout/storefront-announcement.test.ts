import {
  getInitialCountdownSeconds,
  type StorefrontAnnouncementCountdown,
} from '@/components/layout/storefront-announcement';
import { describe, expect, it } from 'vitest';

describe('getInitialCountdownSeconds', () => {
  it('uses a configured fixed duration for each storefront visit', () => {
    const countdown: StorefrontAnnouncementCountdown = {
      mode: 'fixed',
      durationSeconds: 5400,
    };

    expect(getInitialCountdownSeconds(countdown, 0)).toBe(5400);
  });

  it('derives an absolute countdown from the configured end date', () => {
    const countdown: StorefrontAnnouncementCountdown = {
      mode: 'deadline',
      endsAt: '2026-09-04T00:00:00.000Z',
    };

    expect(
      getInitialCountdownSeconds(countdown, Date.parse('2026-09-03T22:30:00.000Z')),
    ).toBe(5400);
  });

  it('returns no countdown when the timer is disabled', () => {
    expect(getInitialCountdownSeconds({ mode: 'none' }, 0)).toBeNull();
  });
});
