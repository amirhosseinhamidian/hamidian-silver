'use client';

import { useReportWebVitals } from 'next/web-vitals';

import { trackAnalyticsEvent } from '@/lib/analytics/analytics';
import { webVitalAnalyticsParameters } from '@/lib/analytics/google-analytics';

type ReportWebVitalsCallback = Parameters<typeof useReportWebVitals>[0];

const reportWebVital: ReportWebVitalsCallback = (metric) => {
  trackAnalyticsEvent('web_vital', webVitalAnalyticsParameters(metric));
};

export function WebVitalsReporter() {
  useReportWebVitals(reportWebVital);
  return null;
}
