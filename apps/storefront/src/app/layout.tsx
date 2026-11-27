import type { Metadata } from 'next';
import { Suspense, type ReactNode } from 'react';

import { StorefrontTelemetry } from '@/components/analytics/storefront-telemetry';
import { validGoogleMeasurementId } from '@/lib/analytics/google-analytics';
import { buildStorefrontRootMetadata } from '@/lib/seo/metadata';
import { getPublicSiteSettings } from '@/lib/site-settings/public-site-settings';
import { peyda } from '@/styles/fonts';

import './globals.css';

export async function generateMetadata(): Promise<Metadata> {
  return buildStorefrontRootMetadata(await getPublicSiteSettings());
}

type RootLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  const measurementId = validGoogleMeasurementId(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID);

  return (
    <html lang="fa" dir="rtl" className={peyda.variable}>
      <body>
        {children}
        <Suspense fallback={null}>
          <StorefrontTelemetry measurementId={measurementId} />
        </Suspense>
      </body>
    </html>
  );
}
