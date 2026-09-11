'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

import { trackAnalyticsEvent } from '@/lib/analytics/analytics';

export function AnalyticsPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const pagePath = query ? `${pathname}?${query}` : pathname;

  useEffect(() => {
    trackAnalyticsEvent('page_view', {
      page_location: window.location.href,
      page_path: pagePath,
      page_title: document.title,
    });
  }, [pagePath]);

  return null;
}
