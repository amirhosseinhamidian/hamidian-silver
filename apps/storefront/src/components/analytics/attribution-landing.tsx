'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import {
  analyticsConsentSince,
  subscribeToAnalyticsConsent,
} from '@/lib/analytics/analytics-consent';
import { rememberAttributionVisit } from '@/lib/analytics/session-attribution';
import { resolveStorefrontSeoRoutePolicy } from '@/lib/seo/route-policy';

export function AttributionLanding() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const consent = useSyncExternalStore(
    subscribeToAnalyticsConsent,
    analyticsConsentSince,
    () => null,
  );
  const initialUrl = useRef<string | null>(null);
  const leftInitialUrl = useRef(false);

  useEffect(() => {
    const current = `${pathname}?${search}`;
    initialUrl.current ??= current;
    if (initialUrl.current !== current) leftInitialUrl.current = true;
    if (consent === null) return;
    const { reason } = resolveStorefrontSeoRoutePolicy(pathname);
    if (reason !== 'public-page' && reason !== 'catalog-page') return;
    rememberAttributionVisit(
      new URLSearchParams(search),
      leftInitialUrl.current ? '' : document.referrer,
      window.location.hostname,
    );
  }, [pathname, search, consent]);
  return null;
}
