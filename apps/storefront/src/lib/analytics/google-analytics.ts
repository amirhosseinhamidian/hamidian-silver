export function validGoogleMeasurementId(value?: string): string | null {
  const normalized = value?.trim().toUpperCase();

  return normalized && /^G-[A-Z0-9]+$/.test(normalized) ? normalized : null;
}

export function setGoogleAnalyticsEnabled(measurementId: string, enabled: boolean): void {
  Reflect.set(window, `ga-disable-${measurementId}`, !enabled);
}

export function initializeGoogleAnalytics(measurementId: string): void {
  setGoogleAnalyticsEnabled(measurementId, true);
  if (typeof window.gtag === 'function') return;

  const dataLayer = (window.dataLayer ??= []);
  const tag: NonNullable<Window['gtag']> = function gtag() {
    // eslint-disable-next-line prefer-rest-params -- Preserve the documented Google tag queue format.
    dataLayer.push(arguments);
  };
  window.gtag = tag;
  tag('js', new Date());
  tag('config', measurementId, {
    send_page_view: false,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    page_location: window.location.origin + '/',
    page_title: 'گالری حمیدیان',
    page_referrer: '',
  });
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
