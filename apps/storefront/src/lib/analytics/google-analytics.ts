export function validGoogleMeasurementId(value?: string): string | null {
  const normalized = value?.trim().toUpperCase();

  return normalized && /^G-[A-Z0-9]+$/.test(normalized) ? normalized : null;
}

export function googleAnalyticsBootstrap(measurementId: string): string {
  return `
window.dataLayer = window.dataLayer || [];
window.gtag = function gtag(){window.dataLayer.push(arguments);};
window.gtag('js', new Date());
window.gtag('config', '${measurementId}', { send_page_view: false });
`;
}
