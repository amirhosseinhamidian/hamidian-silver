'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

import { trackAnalyticsEvent } from '@/lib/analytics/analytics';
import { publicPageView } from '@/lib/analytics/public-page-view';

export function AnalyticsPageView() {
  const pathname = usePathname();
  useEffect(() => {
    const parameters = publicPageView(pathname, window.location.origin);
    if (parameters) trackAnalyticsEvent('page_view', parameters);
  }, [pathname]);

  return null;
}
