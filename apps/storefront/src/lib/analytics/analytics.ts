'use client';

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
    gtag?: (command: 'event', eventName: string, parameters?: AnalyticsParameters) => void;
  }
}

export function tomanToIrr(valueToman: number): number {
  return Math.round(valueToman * 10);
}

export function trackAnalyticsEvent(
  eventName: string,
  parameters: AnalyticsParameters = {},
): boolean {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') {
    return false;
  }

  try {
    window.gtag('event', eventName, parameters);
    return true;
  } catch {
    // Analytics must never interrupt the customer journey.
    return false;
  }
}
