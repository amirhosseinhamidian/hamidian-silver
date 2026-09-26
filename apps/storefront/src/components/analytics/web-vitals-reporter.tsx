'use client';

import { useReportWebVitals } from 'next/web-vitals';

import { trackAnalyticsEvent } from '@/lib/analytics/analytics';
import { webVitalAnalyticsParameters } from '@/lib/analytics/google-analytics';

type ReportWebVitalsCallback = Parameters<typeof useReportWebVitals>[0];

const REPORTED_METRICS = new Set(['LCP', 'INP', 'CLS', 'TTFB']);

const reportWebVital: ReportWebVitalsCallback = (metric) => {
  if (!REPORTED_METRICS.has(metric.name)) return;

  trackAnalyticsEvent('web_vital', {
    ...webVitalAnalyticsParameters(metric),
    page_path: window.location.pathname,
  });
};

export function WebVitalsReporter() {
  useReportWebVitals(reportWebVital);
  return null;
}
