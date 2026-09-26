import { describe, expect, it } from 'vitest';

import {
  googleAnalyticsBootstrap,
  validGoogleMeasurementId,
  webVitalAnalyticsParameters,
} from '@/lib/analytics/google-analytics';

describe('Google Analytics configuration', () => {
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
    expect(googleAnalyticsBootstrap('G-ABC123')).toContain("window.gtag('config', 'G-ABC123'");
    expect(googleAnalyticsBootstrap('G-ABC123')).toContain('send_page_view: false');
    expect(googleAnalyticsBootstrap('G-ABC123')).toContain(
      "page_location: window.location.origin + '/'",
    );
    expect(googleAnalyticsBootstrap('G-ABC123')).toContain("page_title: 'Hamidian Silver'");
  });
});
