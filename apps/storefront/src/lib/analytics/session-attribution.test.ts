import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ANALYTICS_ATTRIBUTION_KEY, setAnalyticsConsent } from './analytics-consent';
import { attributionForOrder, rememberAttributionVisit } from './session-attribution';

const today = new Date('2026-11-20T10:00:00.000Z');
const host = 'hamidian.shop';
function visit(query = '', referrer = '') {
  rememberAttributionVisit(new URLSearchParams(query), referrer, host);
}

describe('session attribution', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(today);
    localStorage.clear();
  });
  afterEach(() => {
    setAnalyticsConsent(false);
    vi.useRealTimers();
  });

  it('stores eligible visits only with consent and clears them on withdrawal', () => {
    const newsletter =
      'utm_source=Newsletter&utm_medium=Email&utm_campaign=Winter+Sale&utm_id=winter-1';
    visit(newsletter);
    expect(localStorage.getItem(ANALYTICS_ATTRIBUTION_KEY)).toBeNull();
    setAnalyticsConsent(true);
    visit(newsletter);
    visit(newsletter);
    visit();
    visit('', 'https://www.hamidian.shop/products/silver-ring');
    vi.setSystemTime(new Date('2026-11-21T10:00:00.000Z'));
    visit('', 'https://example.org/landing?customer=private');
    expect(attributionForOrder()).toEqual({
      version: 1,
      touches: [
        {
          source: 'newsletter',
          medium: 'email',
          occurredAt: today.toISOString(),
          campaign: 'winter-sale',
          campaignId: 'winter-1',
        },
        { source: 'example.org', medium: 'referral', occurredAt: '2026-11-21T10:00:00.000Z' },
      ],
    });
    setAnalyticsConsent(false);
    expect(localStorage.getItem(ANALYTICS_ATTRIBUTION_KEY)).toBeNull();
    expect(attributionForOrder()).toBeUndefined();
  });

  it('drops conflicting tags and prunes expired attribution even on a direct visit', () => {
    setAnalyticsConsent(true);
    visit('utm_source=Newsletter&UTM_SOURCE=Telegram&utm_medium=email');
    expect(attributionForOrder()).toBeUndefined();
    visit('utm_source=Newsletter&utm_medium=email');
    expect(attributionForOrder()?.touches).toHaveLength(1);
    vi.setSystemTime(new Date('2027-03-01T10:00:00.000Z'));
    visit();
    expect(localStorage.getItem(ANALYTICS_ATTRIBUTION_KEY)).toBeNull();
  });
});
