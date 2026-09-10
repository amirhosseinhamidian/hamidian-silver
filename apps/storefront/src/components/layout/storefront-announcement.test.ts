import {
  getFixedCountdownStorageKey,
  getInitialCountdownSeconds,
  resolveFixedCountdownDeadline,
  type StorefrontAnnouncement,
  type StorefrontAnnouncementCountdown,
} from '@/components/layout/storefront-announcement-config';
import { describe, expect, it } from 'vitest';

describe('getInitialCountdownSeconds', () => {
  it('doubles the configured duration for a fixed storefront countdown', () => {
    const countdown: StorefrontAnnouncementCountdown = {
      mode: 'fixed',
      durationSeconds: 5400,
    };

    expect(getInitialCountdownSeconds(countdown, 0)).toBe(10800);
  });

  it('derives an absolute countdown from the configured end date', () => {
    const countdown: StorefrontAnnouncementCountdown = {
      mode: 'deadline',
      endsAt: '2026-09-04T00:00:00.000Z',
    };

    expect(getInitialCountdownSeconds(countdown, Date.parse('2026-09-03T22:30:00.000Z'))).toBe(
      5400,
    );
  });

  it('returns no countdown when the timer is disabled', () => {
    expect(getInitialCountdownSeconds({ mode: 'none' }, 0)).toBeNull();
  });
});

describe('persistent fixed announcement countdown', () => {
  const announcement: StorefrontAnnouncement = {
    enabled: true,
    message: 'فروش ویژه پایان فصل',
    countdown: { mode: 'fixed', durationSeconds: 90 },
    cta: { enabled: true, label: 'مشاهده', href: '/products' },
  };

  it('keeps an existing deadline, including an expired one, across reloads', () => {
    expect(resolveFixedCountdownDeadline('90000', 90, 100000)).toEqual({
      deadlineMs: 90000,
      shouldPersist: false,
    });
  });

  it('creates a doubled deadline only when this announcement has no stored value', () => {
    expect(resolveFixedCountdownDeadline(null, 90, 100000)).toEqual({
      deadlineMs: 280000,
      shouldPersist: true,
    });
  });

  it('changes the storage key when the announcement configuration changes', () => {
    expect(getFixedCountdownStorageKey(announcement)).not.toBe(
      getFixedCountdownStorageKey({ ...announcement, message: 'فروش ویژه جدید' }),
    );
    expect(
      getFixedCountdownStorageKey({ ...announcement, countdown: { mode: 'none' } }),
    ).toBeNull();
  });
});
