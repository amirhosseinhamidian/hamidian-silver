'use client';

import { usePathname } from 'next/navigation';
import { Suspense } from 'react';
import { GoogleAnalytics } from './analytics-consent';
import { AttributionLanding } from './attribution-landing';

export function StorefrontTelemetry({ measurementId }: { measurementId: string | null }) {
  if (usePathname() === '/campaign-preview') return null;
  return (
    <>
      <Suspense fallback={null}>
        <AttributionLanding />
      </Suspense>
      {measurementId && <GoogleAnalytics measurementId={measurementId} />}
    </>
  );
}
