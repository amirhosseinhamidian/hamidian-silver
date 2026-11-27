import { afterEach, describe, expect, it } from 'vitest';

import {
  initializeGoogleAnalytics,
  setGoogleAnalyticsEnabled,
  validGoogleMeasurementId,
  webVitalAnalyticsParameters,
} from '@/lib/analytics/google-analytics';

describe('Google Analytics configuration', () => {
  afterEach(() => {
    delete window.gtag;
    delete window.dataLayer;
    Reflect.deleteProperty(window, 'ga-disable-G-ABC123');
  });

  it('accepts only GA4 measurement IDs', () => {
    expect(validGoogleMeasurementId(' G-ABC123 ')).toBe('G-ABC123');
    expect(validGoogleMeasurementId('UA-12345-1')).toBeNull();
    expect(validGoogleMeasurementId("G-ABC';alert(1)//")).toBeNull();
    expect(validGoogleMeasurementId()).toBeNull();
  });

  it('maps Web Vitals to integer GA parameters without URL data', () => {
    expect(
      webVitalAnalyticsParameters({
        id: 'v4-123',
        name: 'CLS',
        value: 0.084,
        delta: 0.021,
        rating: 'good',
      }),
    ).toEqual({
      metric_name: 'CLS',
      metric_value: 84,
      metric_delta: 21,
      metric_id: 'v4-123',
      metric_rating: 'good',
      non_interaction: true,
    });
  });

  it('disables automatic page views so App Router navigation can track them once', () => {
    initializeGoogleAnalytics('G-ABC123');
    const commands = window.dataLayer?.map((command) => Array.from(command as ArrayLike<unknown>));
    expect(commands?.[1]).toEqual([
      'config',
      'G-ABC123',
      {
        send_page_view: false,
        allow_google_signals: false,
        allow_ad_personalization_signals: false,
        page_location: `${window.location.origin}/`,
        page_title: 'گالری حمیدیان',
        page_referrer: '',
      },
    ]);
    setGoogleAnalyticsEnabled('G-ABC123', false);
    expect(Reflect.get(window, 'ga-disable-G-ABC123')).toBe(true);
  });
});
