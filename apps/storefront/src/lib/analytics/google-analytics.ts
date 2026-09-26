export function validGoogleMeasurementId(value?: string): string | null {
  const normalized = value?.trim().toUpperCase();

  return normalized && /^G-[A-Z0-9]+$/.test(normalized) ? normalized : null;
}

export function googleAnalyticsBootstrap(measurementId: string): string {
  return `
window.dataLayer = window.dataLayer || [];
window.gtag = function gtag(){window.dataLayer.push(arguments);};
window.gtag('js', new Date());
// Default parameters for automatic events must not contain URL query strings.
// Enhanced measurement (especially site search and history changes) must also
// be disabled in the GA4 data stream before enabling the measurement ID.
window.gtag('config', '${measurementId}', {
  send_page_view: false,
  page_location: window.location.origin + '/',
  page_title: 'Hamidian Silver',
  page_referrer: ''
});
`;
}

export type WebVitalMetric = Readonly<{
  id: string;
  name: string;
  value: number;
  delta: number;
  rating?: string;
}>;

export function webVitalAnalyticsParameters(metric: WebVitalMetric) {
  const scale = metric.name === 'CLS' ? 1_000 : 1;

  return {
    metric_name: metric.name,
    metric_value: Math.round(metric.value * scale),
    metric_delta: Math.round(metric.delta * scale),
    metric_id: metric.id,
    metric_rating: metric.rating,
    non_interaction: true,
  } as const;
}
