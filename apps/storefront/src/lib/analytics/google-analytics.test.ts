import { describe, expect, it } from 'vitest';

import {
  googleAnalyticsBootstrap,
  validGoogleMeasurementId,
} from '@/lib/analytics/google-analytics';

describe('Google Analytics configuration', () => {
  it('accepts only GA4 measurement IDs', () => {
    expect(validGoogleMeasurementId(' G-ABC123 ')).toBe('G-ABC123');
    expect(validGoogleMeasurementId('UA-12345-1')).toBeNull();
    expect(validGoogleMeasurementId("G-ABC';alert(1)//")).toBeNull();
    expect(validGoogleMeasurementId()).toBeNull();
  });

  it('disables automatic page views so App Router navigation can track them once', () => {
    expect(googleAnalyticsBootstrap('G-ABC123')).toContain("window.gtag('config', 'G-ABC123'");
    expect(googleAnalyticsBootstrap('G-ABC123')).toContain('send_page_view: false');
  });
});
