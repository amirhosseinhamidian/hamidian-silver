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
