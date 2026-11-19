'use client';

import { analyticsConsentSince } from '@/lib/analytics/analytics-consent';
import {
  initializeGoogleAnalytics,
  validGoogleMeasurementId,
} from '@/lib/analytics/google-analytics';

export const ANALYTICS_CURRENCY = 'IRR';

export type AnalyticsItem = Readonly<{
  item_id: string;
  item_name: string;
  item_brand?: string;
  item_category?: string;
  item_variant?: string;
  price?: number;
  quantity?: number;
}>;

type AnalyticsParameter = string | number | boolean | readonly AnalyticsItem[] | undefined;
type AnalyticsParameters = Readonly<Record<string, AnalyticsParameter>>;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (
      ...args:
        | ['event', string, AnalyticsParameters?]
        | ['config', string, AnalyticsParameters]
        | ['js', Date]
    ) => void;
  }
}

export function tomanToIrr(valueToman: number): number {
  return Math.round(valueToman * 10);
}

export function trackAnalyticsEvent(
  eventName: string,
  parameters: AnalyticsParameters = {},
): boolean {
  if (analyticsConsentSince() === null) {
    return false;
  }

  try {
    const measurementId = validGoogleMeasurementId(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID);
    if (measurementId) initializeGoogleAnalytics(measurementId);
    if (typeof window.gtag !== 'function') return false;
    window.gtag('event', eventName, parameters);
    return true;
  } catch {
    // Analytics must never interrupt the customer journey.
    return false;
  }
}
